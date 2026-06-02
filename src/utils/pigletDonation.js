function hasText(s) {
  return String(s ?? '').trim() !== ''
}

function parseQty(raw) {
  const n = Number.parseInt(String(raw ?? '').trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function effectiveLactationCount(cycle, donatedOut = 0, donatedIn = 0) {
  const born = parseQty(cycle?.bornAlive)
  const dead = parseQty(cycle?.deadLactation)
  const out = Number(donatedOut) || 0
  const inn = Number(donatedIn) || 0
  return Math.max(0, born - dead - out + inn)
}

/**
 * Lactancia ajustable hasta cerrar el destete:
 * sin cantidad destetada, o con cantidad pero faltan lechones por justificar.
 */
function isCycleOpenForDonation(cycle, donatedOut = 0, donatedIn = 0) {
  if (!cycle) return false
  if (!hasText(cycle.frp) || !hasText(cycle.bornAlive)) return false
  if (!hasText(cycle.weanQty)) return true
  if (!hasText(cycle.weanDate)) return false
  const wean = parseQty(cycle.weanQty)
  const expected = effectiveLactationCount(cycle, donatedOut, donatedIn)
  return wean < expected
}

function attachDonationSummariesToCycles(cycles, donations) {
  const outByCycle = new Map()
  const inByCycle = new Map()
  const outListByCycle = new Map()
  const inListByCycle = new Map()

  for (const d of donations) {
    if (!outListByCycle.has(d.fromCycleId)) outListByCycle.set(d.fromCycleId, [])
    outListByCycle.get(d.fromCycleId).push(d)

    if (!inListByCycle.has(d.toCycleId)) inListByCycle.set(d.toCycleId, [])
    inListByCycle.get(d.toCycleId).push(d)

    outByCycle.set(d.fromCycleId, (outByCycle.get(d.fromCycleId) || 0) + d.quantity)
    inByCycle.set(d.toCycleId, (inByCycle.get(d.toCycleId) || 0) + d.quantity)
  }

  return (cycles ?? []).map((cycle) => {
    const donatedOutTotal = outByCycle.get(cycle.id) || 0
    const donatedInTotal = inByCycle.get(cycle.id) || 0
    return {
      ...cycle,
      donationsOut: outListByCycle.get(cycle.id) || [],
      donationsIn: inListByCycle.get(cycle.id) || [],
      donatedOutTotal,
      donatedInTotal,
      lactationEffective: effectiveLactationCount(cycle, donatedOutTotal, donatedInTotal),
    }
  })
}

module.exports = {
  hasText,
  parseQty,
  effectiveLactationCount,
  isCycleOpenForDonation,
  attachDonationSummariesToCycles,
}
