/**
 * Fechas en calendario local (YYYY-MM-DD), sin UTC.
 */

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Hoy en zona local como YYYY-MM-DD */
function todayIsoLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Normaliza a YYYY-MM-DD o null si no es válida (acepta Date de mysql2) */
function normalizeIsoDate(raw) {
  if (raw == null) return null
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`
  }
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

/** Suma días calendario a YYYY-MM-DD */
function addCalendarDays(isoDate, daysToAdd) {
  const iso = normalizeIsoDate(isoDate)
  if (!iso) return null
  const [y, mo, d] = iso.split('-').map(Number)
  const date = new Date(y, mo - 1, d)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + daysToAdd)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * Diferencia en días calendario: to - from (orden temporal).
 * @returns {number | null}
 */
function diffCalendarDays(fromIso, toIso) {
  const a = normalizeIsoDate(fromIso)
  const b = normalizeIsoDate(toIso)
  if (!a || !b) return null
  const [y0, m0, d0] = a.split('-').map(Number)
  const [y1, m1, d1] = b.split('-').map(Number)
  const t0 = new Date(y0, m0 - 1, d0)
  const t1 = new Date(y1, m1 - 1, d1)
  return Math.round((t1 - t0) / 86400000)
}

const GESTATION_DAYS_PIG = 114
const NEAR_PARTO_DAYS = 3

module.exports = {
  todayIsoLocal,
  normalizeIsoDate,
  addCalendarDays,
  diffCalendarDays,
  GESTATION_DAYS_PIG,
  NEAR_PARTO_DAYS,
}
