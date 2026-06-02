const { normalizeIsoDate, diffCalendarDays } = require('../utils/dateUtils')

/**
 * Comprueba si la fecha de aplicación cae en el día objetivo o en la ventana [target, windowEnd].
 * Si no hay ventana (windowEnd vacío o igual a target), solo vale el día exacto.
 */
function isAdministeredDateInAllowedWindow(administeredIso, targetIso, windowEndIso) {
  const a = normalizeIsoDate(administeredIso)
  const t = normalizeIsoDate(targetIso)
  if (!a || !t) return false
  const w = normalizeIsoDate(windowEndIso)
  if (!w || w === t) return a === t
  if (a < t || a > w) return false
  return true
}

/** La aplicación no puede ser posterior a "hoy" (ISO local del servidor). */
function isAdministeredDateNotAfterToday(administeredIso, todayIso) {
  const d = diffCalendarDays(administeredIso, todayIso)
  if (d === null) return false
  return d >= 0
}

module.exports = {
  isAdministeredDateInAllowedWindow,
  isAdministeredDateNotAfterToday,
}
