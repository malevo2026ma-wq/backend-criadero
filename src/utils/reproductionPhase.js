const {
  normalizeIsoDate,
  addCalendarDays,
  diffCalendarDays,
  GESTATION_DAYS_PIG,
  NEAR_PARTO_DAYS,
} = require('./dateUtils')

function hasText(s) {
  return String(s ?? '').trim() !== ''
}

function isNacidosComplete(cycle) {
  if (!cycle) return false
  return (
    hasText(cycle.bornAlive) &&
    hasText(cycle.bornDead) &&
    hasText(cycle.bornFetuses)
  )
}

function isWeanDetalleComplete(cycle) {
  if (!cycle) return false
  return hasText(cycle.weanQty) && hasText(cycle.weanAvgWeight)
}

function isLastCycleComplete(cycle) {
  if (!cycle) return false
  return (
    hasText(cycle.fs) &&
    hasText(cycle.frp) &&
    isNacidosComplete(cycle) &&
    hasText(cycle.weanDate) &&
    isWeanDetalleComplete(cycle)
  )
}

function isLactatingFromRow(row) {
  if (!hasText(row.lastFrp)) return false
  return !hasText(row.lastWeanDate)
}

function isPregnantFromRow(row) {
  if (hasText(row.lastFrp)) return false
  if (hasText(row.lastFs)) return true
  return hasText(row.serviceDate)
}

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

function isNearPartoFromRow(row, todayIso) {
  if (!isPregnantFromRow(row)) return false
  const exp = expectedFppIso(row)
  if (!exp) return false
  const delta = diffCalendarDays(todayIso, exp)
  if (delta === null) return false
  return Math.abs(delta) <= NEAR_PARTO_DAYS
}

/**
 * Fase operativa (misma lógica que frontend sowCardPhase).
 * @returns {string}
 */
function getOperationalPhase(row) {
  const hasCycles = Number(row.cycleCount) > 0
  if (!hasCycles) {
    if (!hasText(row.serviceDate)) return 'no_service'
    return 'parto'
  }
  if (!hasText(row.lastFs)) return 'need_fs'
  if (!hasText(row.lastFrp)) return 'parto'
  if (!hasText(row.lastBornAlive) || !hasText(row.lastBornDead) || !hasText(row.lastBornFetuses)) {
    return 'nacidos'
  }
  if (!hasText(row.lastWeanDate)) return 'destete_fecha'
  if (!hasText(row.lastWeanQty) || !hasText(row.lastWeanAvgWeight)) return 'destete_detalle'
  return 'cycle_complete'
}

/**
 * Estado resumido para filtros del rodeo.
 */
function getRodeoStatus(row, todayIso) {
  if (isLactatingFromRow(row)) return 'lactating'
  if (isPregnantFromRow(row)) {
    if (isNearPartoFromRow(row, todayIso)) return 'near_parto'
    return 'pregnant'
  }
  const phase = getOperationalPhase(row)
  if (phase === 'cycle_complete') return 'ready'
  if (phase === 'no_service') return 'inactive'
  return 'pending'
}

const PHASE_LABELS = {
  no_service: 'Sin servicio',
  need_fs: 'F/S pendiente',
  parto: 'Parto pendiente',
  nacidos: 'Nacidos pendientes',
  destete_fecha: 'Destete (fecha)',
  destete_detalle: 'Detalle destete',
  cycle_complete: 'Ciclo completo',
}

const STATUS_LABELS = {
  pregnant: 'Preñada',
  near_parto: 'Cerca del parto',
  lactating: 'Lactando',
  pending: 'Acción pendiente',
  ready: 'Lista para nuevo ciclo',
  inactive: 'Sin servicio',
}

module.exports = {
  hasText,
  isLactatingFromRow,
  isPregnantFromRow,
  expectedFppIso,
  isNearPartoFromRow,
  getOperationalPhase,
  getRodeoStatus,
  PHASE_LABELS,
  STATUS_LABELS,
  isLastCycleComplete,
  NEAR_PARTO_DAYS,
}
