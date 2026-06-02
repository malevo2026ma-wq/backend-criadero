const { randomUUID } = require('crypto')
const { VACCINATION_CATALOG } = require('../constants/vaccinationCatalog')
const { addCalendarDays, normalizeIsoDate, todayIsoLocal, diffCalendarDays } = require('../utils/dateUtils')
const vaccinationRepository = require('../models/vaccinationRepository')
const vaccinationCatalogRepository = require('../models/vaccinationCatalogRepository')
const { AppError } = require('../utils/AppError')
const {
  isAdministeredDateInAllowedWindow,
  isAdministeredDateNotAfterToday,
} = require('./vaccinationDateValidation')

function anchorIso(cycleRow, anchor) {
  const raw = anchor === 'fs' ? cycleRow.fs : cycleRow.frp
  return normalizeIsoDate(raw)
}

function computeDates(cycleRow, item) {
  const iso = anchorIso(cycleRow, item.anchor)
  if (!iso) {
    return { targetDate: null, windowEndDate: null }
  }
  const target = addCalendarDays(iso, item.dayOffset)
  let windowEnd = null
  if (item.windowEndOffset != null) {
    windowEnd = addCalendarDays(iso, item.windowEndOffset)
  }
  return { targetDate: target, windowEndDate: windowEnd }
}

function hasAnchorDate(raw) {
  return Boolean(normalizeIsoDate(raw))
}

function isActiveGestation(lastCycle) {
  return (
    hasAnchorDate(lastCycle.fs) &&
    !hasAnchorDate(lastCycle.frp) &&
    !hasAnchorDate(lastCycle.weanDate)
  )
}

function isActiveLactation(lastCycle) {
  return hasAnchorDate(lastCycle.frp) && !hasAnchorDate(lastCycle.weanDate)
}

async function loadCatalogItems(conn) {
  try {
    const rows = await vaccinationCatalogRepository.listActiveCatalog(conn)
    if (rows && rows.length > 0) return rows
  } catch (err) {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[vaccinations] catálogo BD no disponible, uso estático:', err?.message || err)
    }
  }
  return VACCINATION_CATALOG
}

function catalogForPhase(phase, allItems) {
  if (phase === 'gestacion') {
    return allItems.filter((i) => i.category === 'gestacion')
  }
  if (phase === 'maternidad') {
    return allItems.filter((i) => i.category !== 'gestacion')
  }
  return []
}

/**
 * Plan vacunal sobre el último ciclo en fase activa.
 * En maternidad se conservan también las filas de gestación del mismo ciclo si hubo F/S (historial y bloqueo de parto).
 */
async function syncSowCycles(conn, sowId) {
  const cycles = await vaccinationRepository.listCyclesForSow(conn, sowId)
  if (!cycles.length) {
    await vaccinationRepository.deleteAllVaccinationsForSow(conn, sowId)
    return
  }

  const last = cycles[cycles.length - 1]
  let phase = null
  if (isActiveGestation(last)) phase = 'gestacion'
  else if (isActiveLactation(last)) phase = 'maternidad'

  if (!phase) {
    await vaccinationRepository.deleteAllVaccinationsForSow(conn, sowId)
    return
  }

  const allItems = await loadCatalogItems(conn)
  let items = []
  if (phase === 'gestacion') {
    items = catalogForPhase('gestacion', allItems)
  } else {
    const lact = catalogForPhase('maternidad', allItems)
    if (hasAnchorDate(last.fs)) {
      items = [...catalogForPhase('gestacion', allItems), ...lact]
    } else {
      items = lact
    }
  }

  const allowedKeys = items.map((i) => i.key)
  await vaccinationRepository.deleteVaccinationsOutsidePlan(conn, sowId, last.id, allowedKeys)

  for (const item of items) {
    const { targetDate, windowEndDate } = computeDates(last, item)
    const existingId = await vaccinationRepository.findExistingId(conn, last.id, item.key)
    const id = existingId || randomUUID()
    await vaccinationRepository.upsertVaccinationRow(conn, {
      id,
      cycleId: last.id,
      vaccineKey: item.key,
      category: item.category,
      sortOrder: item.sortOrder,
      label: item.label,
      doseText: item.doseText,
      isOptional: item.isOptional,
      anchor: item.anchor,
      dayOffset: item.dayOffset,
      windowEndOffset: item.windowEndOffset,
      targetDate,
      windowEndDate,
    })
  }
}

function statusForRow(row, todayIso) {
  if (row.skipped) return 'skipped'
  if (row.administeredDate) return 'completed'
  if (!row.targetDate) return 'pending_date'
  const d = diffCalendarDays(row.targetDate, todayIso)
  if (d === null) return 'pending'
  if (d > 0) return 'overdue'
  if (d === 0) return 'due_today'
  return 'scheduled'
}

async function listDashboard(query) {
  const todayIso = todayIsoLocal()
  const rows = await vaccinationRepository.listDashboardRows({
    category: query.category,
    sowNumber: query.sowNumber,
    includeCompletedDays: query.includeCompletedDays ?? 14,
  })
  return rows.map((row) => ({
    ...row,
    status: statusForRow(row, todayIso),
    cycleLabel: `Ciclo ${(row.cycleSort ?? 0) + 1}`,
  }))
}

async function patchVaccination(id, body) {
  const existing = await vaccinationRepository.findById(id)
  if (!existing) {
    throw new AppError('Registro vacunal no encontrado.', 404)
  }

  const todayIso = todayIsoLocal()
  const administeredDate =
    body.administeredDate !== undefined ? normalizeIsoDate(body.administeredDate) : undefined

  const fields = {}
  if (body.skipped === true) {
    if (!existing.isOptional) {
      throw new AppError('Solo las vacunas marcadas como opcionales pueden omitirse (skipped).', 400)
    }
    fields.skipped = true
    fields.administeredDate = null
  } else {
    if (body.administeredDate !== undefined) {
      if (body.administeredDate === '') {
        fields.administeredDate = null
        fields.skipped = false
      } else {
        if (!administeredDate) {
          throw new AppError('Fecha de aplicación inválida.', 400)
        }
        if (!normalizeIsoDate(existing.targetDate)) {
          throw new AppError(
            'No hay fecha objetivo para esta vacuna. Registre F/S o F/R.P en el ciclo antes de aplicar.',
            400,
          )
        }
        if (!isAdministeredDateNotAfterToday(administeredDate, todayIso)) {
          throw new AppError('La fecha de aplicación no puede ser posterior a hoy.', 400)
        }
        const enforceWindow =
          process.env.VACCINATION_ENFORCE_APPLICATION_WINDOW === 'true' ||
          process.env.VACCINATION_ENFORCE_APPLICATION_WINDOW === '1'
        const allowOutside = body.outsideWindow === true || !enforceWindow
        if (
          !allowOutside &&
          !isAdministeredDateInAllowedWindow(
            administeredDate,
            existing.targetDate,
            existing.windowEndDate || existing.targetDate,
          )
        ) {
          const target = existing.targetDate || '—'
          const end = existing.windowEndDate || target
          throw new AppError(
            `La fecha debe estar entre ${target} y ${end} (ventana del protocolo). Podés marcar «Fuera de ventana» para registrar igual.`,
            400,
          )
        }
        fields.administeredDate = administeredDate
        fields.skipped = false
      }
    }
    if (body.batchNo !== undefined) fields.batchNo = body.batchNo
    if (body.notes !== undefined) fields.notes = body.notes
    if (body.skipped === false) fields.skipped = false
  }

  await vaccinationRepository.updateApplication(null, id, fields)

  return vaccinationRepository.findById(id)
}

async function rebuildAllSowVaccinations() {
  const ids = await vaccinationRepository.listSowIds()
  for (const sowId of ids) {
    await syncSowCycles(null, sowId)
  }
  return { syncedSows: ids.length }
}

async function getProtocolCatalog() {
  const items = await loadCatalogItems(null)
  return { items }
}

module.exports = {
  syncSowCycles,
  listDashboard,
  patchVaccination,
  rebuildAllSowVaccinations,
  getProtocolCatalog,
}
