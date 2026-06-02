/** Mensaje legible en español a partir del primer issue de Zod. */
function zodFirstMessage(error, fallback = 'Datos inválidos.') {
  const issue = error?.issues?.[0]
  if (!issue) return fallback

  const path = issue.path?.join('.') ?? ''
  if (path === 'includeCompletedDays' && (issue.code === 'too_big' || issue.code === 'too_small')) {
    return 'El parámetro de historial de vacunas debe estar entre 0 y 90 días.'
  }

  return issue.message || fallback
}

module.exports = { zodFirstMessage }
