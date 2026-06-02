const { randomUUID } = require('crypto')
const { pool } = require('../config/db')
const { AppError } = require('../utils/AppError')
const sowRepository = require('../models/sowRepository')
const vaccinationService = require('./vaccinationService')
const vaccinationGateService = require('./vaccinationGateService')
const sowDonationService = require('./sowDonationService')
const sowDonationRepository = require('../models/sowDonationRepository')
const { assertCyclesWeanReconciliation } = require('../utils/weanReconciliation')
const {
  todayIsoLocal,
  normalizeIsoDate,
  addCalendarDays,
  diffCalendarDays,
  GESTATION_DAYS_PIG,
  NEAR_PARTO_DAYS,
} = require('../utils/dateUtils')

function hasText(s) {
  return String(s ?? '').trim() !== ''
}

/** Último ciclo con parto real → lactando si hay destete pendiente */
function isLactating(row) {
  if (!hasText(row.lastFrp)) return false
  return !hasText(row.lastWeanDate)
}

/**
 * Preñada: sin parto registrado en el último ciclo y con servicio (F/S de última fila o solo cabecera).
 */
function isPregnant(row) {
  if (hasText(row.lastFrp)) return false
  if (hasText(row.lastFs)) return true
  return hasText(row.serviceDate)
}

/**
 * F/P.P esperada para una cerda preñada: BD o F/S + 114; sin ciclos, cabecera + 114.
 */
function expectedFppIso(row) {
  if (hasText(row.lastFs)) {
    const fromDb = normalizeIsoDate(row.lastFpp)
    if (fromDb) return fromDb
    const fs = normalizeIsoDate(row.lastFs)
    if (fs) return addCalendarDays(fs, GESTATION_DAYS_PIG)
    return null
  }
  const sd = normalizeIsoDate(row.serviceDate)
  if (sd) return addCalendarDays(sd, GESTATION_DAYS_PIG)
  return null
}

/** Parto probable dentro de ±NEAR_PARTO_DAYS días (hoy vs F/P.P) */
function isNearParto(row, todayIso) {
  if (!isPregnant(row)) return false
  const exp = expectedFppIso(row)
  if (!exp) return false
  const delta = diffCalendarDays(todayIso, exp)
  if (delta === null) return false
  return Math.abs(delta) <= NEAR_PARTO_DAYS
}

async function getDashboardStats() {
  const rows = await sowRepository.listSowsDashboardRows()
  const todayIso = todayIsoLocal()
  let total = 0
  let prenadas = 0
  let amamantando = 0
  let cercaParto = 0
  for (const row of rows) {
    total += 1
    if (isLactating(row)) {
      amamantando += 1
    } else if (isPregnant(row)) {
      prenadas += 1
      if (isNearParto(row, todayIso)) {
        cercaParto += 1
      }
    }
  }
  return { total, prenadas, amamantando, cercaParto }
}

function nearPartoLabel(daysToParto) {
  if (daysToParto === 0) return 'Parto hoy (F/P.P)'
  if (daysToParto < 0) {
    const n = Math.abs(daysToParto)
    return n === 1 ? 'F/P.P ayer' : `F/P.P hace ${n} días`
  }
  if (daysToParto === 1) return 'Parto mañana (F/P.P)'
  return `Parto en ${daysToParto} días`
}

async function getHomeAlerts() {
  const todayIso = todayIsoLocal()
  const rows = await sowRepository.listSowsDashboardRows()
  const nearParto = []

  for (const row of rows) {
    if (!isNearParto(row, todayIso)) continue
    const expectedPartoDate = expectedFppIso(row)
    if (!expectedPartoDate) continue
    const daysToParto = diffCalendarDays(todayIso, expectedPartoDate)
    if (daysToParto === null) continue
    nearParto.push({
      sowId: row.id,
      sowNumber: row.number,
      expectedPartoDate,
      daysToParto,
      urgencyLabel: nearPartoLabel(daysToParto),
      lastFs: row.lastFs || row.serviceDate || '',
    })
  }

  nearParto.sort((a, b) => a.daysToParto - b.daysToParto)

  const vacRows = await vaccinationService.listDashboard({ includeCompletedDays: 0 })
  const dueNow = vacRows.filter(
    (r) =>
      !r.isOptional &&
      !r.administeredDate &&
      !r.skipped &&
      (r.status === 'due_today' || r.status === 'overdue'),
  )

  const bySow = new Map()
  for (const v of dueNow) {
    if (!bySow.has(v.sowId)) {
      bySow.set(v.sowId, {
        sowId: v.sowId,
        sowNumber: v.sowNumber,
        vaccines: [],
      })
    }
    bySow.get(v.sowId).vaccines.push({
      id: v.id,
      label: v.label,
      category: v.category,
      status: v.status,
      targetDate: v.targetDate,
      windowEndDate: v.windowEndDate,
      doseText: v.doseText,
    })
  }

  const catOrder = { gestacion: 0, maternidad_hembra: 1, maternidad_lechon: 2 }
  const dueVaccinations = [...bySow.values()]
    .map((entry) => ({
      ...entry,
      vaccines: [...entry.vaccines].sort((a, b) => {
        const ca = catOrder[a.category] ?? 9
        const cb = catOrder[b.category] ?? 9
        if (ca !== cb) return ca - cb
        return String(a.targetDate).localeCompare(String(b.targetDate))
      }),
    }))
    .sort((a, b) =>
      String(a.sowNumber).localeCompare(String(b.sowNumber), undefined, { numeric: true }),
    )

  return {
    nearParto,
    dueVaccinations,
    counts: {
      nearParto: nearParto.length,
      dueVaccinations: dueVaccinations.length,
      dueVaccineDoses: dueNow.length,
    },
  }
}

async function listSows(query) {
  return sowRepository.listSowsSummary({
    number: query?.number,
  })
}

async function getSowById(sowId) {
  const sow = await sowRepository.getSowWithCycles(sowId)
  if (!sow) {
    throw new AppError('Cerda no encontrada.', 404)
  }
  return sowDonationService.enrichSowWithDonations(sow)
}

function lastCycle(cycles) {
  if (!cycles || cycles.length === 0) return null
  return cycles[cycles.length - 1]
}

/** Evita reutilizar ids de ciclos de otra cerda al hacer upsert. */
async function donationTotalsByCycle(cycleIds, conn = null) {
  const donations = await sowDonationRepository.listDonationsForCycleIds(cycleIds, conn)
  const map = new Map()
  for (const d of donations) {
    if (!map.has(d.fromCycleId)) map.set(d.fromCycleId, { out: 0, in: 0 })
    if (!map.has(d.toCycleId)) map.set(d.toCycleId, { out: 0, in: 0 })
    const from = map.get(d.fromCycleId)
    const to = map.get(d.toCycleId)
    from.out += d.quantity
    to.in += d.quantity
  }
  return map
}

async function assertCyclesBelongToSow(conn, sowId, cycles) {
  const ids = (cycles ?? []).map((c) => c.id).filter(Boolean)
  if (!ids.length) return
  const owners = await sowRepository.findCycleOwners(conn, ids)
  for (const id of ids) {
    const owner = owners.get(id)
    if (owner && owner !== sowId) {
      throw new AppError('Identificador de ciclo inválido para esta cerda.', 400)
    }
  }
}

async function createSow(body) {
  const existing = await sowRepository.findSowByNumber(body.number)
  if (existing) {
    throw new AppError('Ya existe una planilla con ese número de chancha.', 409)
  }

  const sowId = randomUUID()
  const cycles = body.cycles ?? []

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await sowRepository.insertSow(connection, sowId, {
      number: body.number,
      entryDate: body.entryDate,
      birthDate: body.birthDate,
      serviceDate: body.serviceDate,
      breed: body.breed,
    })
    if (cycles.length > 0) {
      const cycleIds = cycles.map((c) => c.id).filter(Boolean)
      const totals = await donationTotalsByCycle(cycleIds, connection)
      assertCyclesWeanReconciliation(cycles, totals)
      await sowRepository.insertCycles(connection, sowId, cycles)
    }
    await vaccinationService.syncSowCycles(connection, sowId)
    const last = lastCycle(cycles)
    if (last && normalizeIsoDate(last.fs) && normalizeIsoDate(last.frp)) {
      await vaccinationGateService.assertGestationCompleteForFarowing(last.id, connection)
    }
    if (last && normalizeIsoDate(last.frp) && normalizeIsoDate(last.weanDate)) {
      await vaccinationGateService.assertMaternityCompleteForWeaning(last.id, connection)
    }
    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  const sow = await sowRepository.getSowWithCycles(sowId)
  return sowDonationService.enrichSowWithDonations(sow)
}

async function updateSow(sowId, body) {
  if (body.id !== sowId) {
    throw new AppError('El identificador no coincide con la ruta.', 400)
  }

  const current = await sowRepository.findSowById(sowId)
  if (!current) {
    throw new AppError('Cerda no encontrada.', 404)
  }

  const taken = await sowRepository.findSowByNumberExcluding(body.number, sowId)
  if (taken) {
    throw new AppError('Ya existe otra planilla con ese número de chancha.', 409)
  }

  const before = await sowRepository.getSowWithCycles(sowId)
  const oldLast = lastCycle(before?.cycles)
  const newLast = lastCycle(body.cycles)
  const addingFrp =
    oldLast &&
    newLast &&
    oldLast.id === newLast.id &&
    normalizeIsoDate(oldLast.fs) &&
    !normalizeIsoDate(oldLast.frp) &&
    normalizeIsoDate(newLast.frp)
  const addingWeanDate =
    oldLast &&
    newLast &&
    oldLast.id === newLast.id &&
    normalizeIsoDate(oldLast.frp) &&
    !normalizeIsoDate(oldLast.weanDate) &&
    normalizeIsoDate(newLast.weanDate)

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    if (addingFrp) {
      await vaccinationGateService.assertGestationCompleteForFarowing(oldLast.id, connection)
    }
    if (addingWeanDate) {
      await vaccinationGateService.assertMaternityCompleteForWeaning(oldLast.id, connection)
    }
    await assertCyclesBelongToSow(connection, sowId, body.cycles)
    const cycleIds = (body.cycles ?? []).map((c) => c.id).filter(Boolean)
    const totals = await donationTotalsByCycle(cycleIds, connection)
    assertCyclesWeanReconciliation(body.cycles ?? [], totals)
    await sowRepository.updateSowHeader(connection, sowId, {
      number: body.number,
      entryDate: body.entryDate,
      birthDate: body.birthDate,
      serviceDate: body.serviceDate,
      breed: body.breed,
    })
    await sowRepository.syncCyclesForSow(connection, sowId, body.cycles ?? [])
    await vaccinationService.syncSowCycles(connection, sowId)
    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  const sow = await sowRepository.getSowWithCycles(sowId)
  return sowDonationService.enrichSowWithDonations(sow)
}

module.exports = {
  listSows,
  getDashboardStats,
  getHomeAlerts,
  getSowById,
  createSow,
  updateSow,
}
