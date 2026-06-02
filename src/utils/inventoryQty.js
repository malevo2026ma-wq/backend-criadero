/** Redondeo consistente para kg en inventario (3 decimales). */
function roundQtyKg(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1000) / 1000
}

/**
 * Cantidad de ingrediente para producir `outputKg` de alimento.
 * @param {number} outputKg - kg de alimento producido
 * @param {number} partsPerBatch - kg ingrediente por lote base
 * @param {number} batchSizeKg - tamaño del lote base (típ. 1000)
 */
function ingredientQtyForOutput(outputKg, partsPerBatch, batchSizeKg) {
  const out = Number(outputKg)
  const parts = Number(partsPerBatch)
  const batch = Number(batchSizeKg) || 1000
  if (!Number.isFinite(out) || out <= 0 || !Number.isFinite(parts) || parts < 0) return 0
  return roundQtyKg((out / batch) * parts)
}

module.exports = { roundQtyKg, ingredientQtyForOutput }
