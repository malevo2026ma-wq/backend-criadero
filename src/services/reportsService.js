const { AppError } = require('../utils/AppError')
const { normalizeIsoDate, diffCalendarDays } = require('../utils/dateUtils')
const { ESTABLISHMENT_NAME } = require('../constants/farmConstants')
const reportsRepository = require('../models/reportsRepository')

/** Máximo ~24 meses de consulta. */
const MAX_RANGE_DAYS = 730

function parseNonNegativeInt(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function assertValidRange(fromIso, toIso) {
  const from = normalizeIsoDate(fromIso)
  const to = normalizeIsoDate(toIso)
  if (!from || !to) throw new AppError('Rango de fechas inválido.', 400)
  if (from > to) throw new AppError('La fecha desde no puede ser posterior a la fecha hasta.', 400)
  const span = diffCalendarDays(from, to)
  if (span == null) throw new AppError('Rango de fechas inválido.', 400)
  if (span > MAX_RANGE_DAYS) {
    throw new AppError(`El rango no puede superar ${MAX_RANGE_DAYS} días (~24 meses).`, 400)
  }
  return { from, to }
}

function isoInRange(iso, fromIso, toIso) {
  const d = normalizeIsoDate(iso)
  if (!d) return false
  return d >= fromIso && d <= toIso
}

function formatDisplayDate(iso) {
  const d = normalizeIsoDate(iso)
  if (!d) return ''
  const [y, mo, day] = d.split('-').map(Number)
  try {
    return new Date(y, mo - 1, day).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

function formatRangeLabelEs(fromIso, toIso) {
  const from = normalizeIsoDate(fromIso)
  const to = normalizeIsoDate(toIso)
  if (!from || !to) return ''
  const fmt = (iso) => {
    const [y, mo, day] = iso.split('-').map(Number)
    return new Date(y, mo - 1, day).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  if (from === to) return fmt(from)
  return `${fmt(from)} – ${fmt(to)}`
}

function computeBirthTotals(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.bornAlive += parseNonNegativeInt(r.bornAlive)
      acc.bornDead += parseNonNegativeInt(r.bornDead)
      acc.bornMummified += parseNonNegativeInt(r.bornMummified)
      acc.bornTotal += parseNonNegativeInt(r.bornTotal)
      return acc
    },
    { bornAlive: 0, bornDead: 0, bornMummified: 0, bornTotal: 0, count: rows.length },
  )
}

function computeWeaningTotals(rows) {
  const piglets = rows.reduce((s, r) => s + parseNonNegativeInt(r.piglets), 0)
  const withDays = rows.filter((r) => String(r.daysOfLife ?? '').trim() !== '')
  const avgDays =
    withDays.length > 0
      ? Math.round(
          withDays.reduce((s, r) => s + parseNonNegativeInt(r.daysOfLife), 0) / withDays.length,
        )
      : null
  return { piglets, count: rows.length, avgDaysOfLife: avgDays }
}

async function getBirthsWeaningsReport(fromDate, toDate) {
  const { from, to } = assertValidRange(fromDate, toDate)

  const [allBirths, allWeanings] = await Promise.all([
    reportsRepository.listBirthCyclesRaw(),
    reportsRepository.listWeaningCyclesRaw(),
  ])

  const births = allBirths
    .filter((r) => isoInRange(r.date, from, to))
    .map((r) => ({
      ...r,
      dateIso: normalizeIsoDate(r.date),
      dateDisplay: formatDisplayDate(r.date),
      bornAliveNum: parseNonNegativeInt(r.bornAlive),
      bornDeadNum: parseNonNegativeInt(r.bornDead),
      bornMummifiedNum: parseNonNegativeInt(r.bornMummified),
      bornTotalNum: parseNonNegativeInt(r.bornTotal),
    }))

  const weanings = allWeanings
    .filter((r) => isoInRange(r.date, from, to))
    .map((r) => ({
      ...r,
      dateIso: normalizeIsoDate(r.date),
      dateDisplay: formatDisplayDate(r.date),
      pigletsNum: parseNonNegativeInt(r.piglets),
      daysOfLifeNum: parseNonNegativeInt(r.daysOfLife),
    }))

  return {
    establishment: ESTABLISHMENT_NAME,
    fromDate: from,
    toDate: to,
    rangeLabel: formatRangeLabelEs(from, to),
    births,
    weanings,
    birthTotals: computeBirthTotals(births),
    weaningTotals: computeWeaningTotals(weanings),
  }
}

module.exports = {
  getBirthsWeaningsReport,
  MAX_RANGE_DAYS,
}
