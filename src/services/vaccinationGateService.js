const vaccinationRepository = require('../models/vaccinationRepository')
const { AppError } = require('../utils/AppError')

/**
 * Antes de registrar parto (F/R.P) en un ciclo que ya tenía F/S, exige plan de gestación
 * y todas las vacunas obligatorias aplicadas (las opcionales pueden quedar pendientes u omitidas).
 * @param {string} cycleId
 * @param {import('mysql2/promise').PoolConnection | null} conn
 */
async function assertGestationCompleteForFarowing(cycleId, conn = null) {
  const n = await vaccinationRepository.countGestationVaccinationsForCycle(cycleId, conn)
  if (n === 0) {
    throw new AppError(
      'No hay vacunas de gestación planificadas para este ciclo. Registre F/S y el plan vacunal antes del parto, o ejecute la sincronización desde administración.',
      409,
    )
  }
  const missing = await vaccinationRepository.listIncompleteRequiredGestationForCycle(cycleId, conn)
  if (missing.length > 0) {
    const labels = missing.map((m) => m.label).join(', ')
    throw new AppError(
      `No se puede registrar el parto: faltan vacunas obligatorias de gestación (${labels}).`,
      409,
    )
  }
}

/**
 * Antes de registrar destete (fecha) en un ciclo lactando, exige plan de maternidad
 * y todas las vacunas obligatorias aplicadas (las opcionales pueden omitirse).
 * @param {string} cycleId
 * @param {import('mysql2/promise').PoolConnection | null} conn
 */
async function assertMaternityCompleteForWeaning(cycleId, conn = null) {
  const n = await vaccinationRepository.countMaternityVaccinationsForCycle(cycleId, conn)
  if (n === 0) {
    throw new AppError(
      'No hay vacunas de maternidad planificadas para este ciclo. Registre F/R.P y sincronice el plan vacunal antes del destete.',
      409,
    )
  }
  const missing = await vaccinationRepository.listIncompleteRequiredMaternityForCycle(cycleId, conn)
  if (missing.length > 0) {
    const labels = missing.map((m) => m.label).join(', ')
    throw new AppError(
      `No se puede registrar el destete: faltan vacunas obligatorias de maternidad (${labels}).`,
      409,
    )
  }
}

module.exports = {
  assertGestationCompleteForFarowing,
  assertMaternityCompleteForWeaning,
}
