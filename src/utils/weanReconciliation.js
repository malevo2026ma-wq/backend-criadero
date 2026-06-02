const { hasText, parseQty, effectiveLactationCount } = require('./pigletDonation')
const { AppError } = require('./AppError')

function getWeanReconciliation(cycle, donatedOut = 0, donatedIn = 0) {
  if (!cycle || !hasText(cycle.weanDate) || !hasText(cycle.weanQty)) return null
  const wean = parseQty(cycle.weanQty)
  const expected = effectiveLactationCount(cycle, donatedOut, donatedIn)
  if (wean > expected) {
    return { expected, wean, gap: 0, over: true }
  }
  const gap = expected - wean
  if (gap <= 0) return null
  return { expected, wean, gap, over: false }
}

function assertCyclesWeanReconciliation(cycles, donationTotalsByCycle = new Map()) {
  for (const cycle of cycles ?? []) {
    if (!hasText(cycle.weanDate) || !hasText(cycle.weanQty)) continue
    const totals = donationTotalsByCycle.get(cycle.id) || { out: 0, in: 0 }
    const rec = getWeanReconciliation(cycle, totals.out, totals.in)
    if (!rec) continue
    if (rec.over) {
      throw new AppError(
        `Ciclo con parto ${cycle.frp || '—'}: la cantidad destetada (${rec.wean}) supera los ${rec.expected} en lactancia (ajustados).`,
        400,
      )
    }
    throw new AppError(
      `Antes de guardar el destete, justificá ${rec.gap} lechón(es) faltante(s) (donación o muertos en lactancia). En lactancia: ${rec.expected}, destetados: ${rec.wean}.`,
      400,
    )
  }
}

module.exports = {
  getWeanReconciliation,
  assertCyclesWeanReconciliation,
}
