const { AppError } = require('../utils/AppError')
const feedCatalogRepository = require('../models/feedCatalogRepository')
const feedRecipeRepository = require('../models/feedRecipeRepository')
const ingredientInventoryRepository = require('../models/ingredientInventoryRepository')
const ingredientInventoryService = require('./ingredientInventoryService')
const { ingredientQtyForOutput } = require('../utils/inventoryQty')

/**
 * Descuenta ingredientes al registrar entrada de stock de un alimento preparado.
 * Debe ejecutarse dentro de la misma transacción que el movimiento de alimento.
 */
async function deductForFeedProduction(
  conn,
  { feedKey, outputKg, feedMovementId, feedLabel, createdBy },
) {
  const feed = await feedCatalogRepository.findByKey(feedKey, conn)
  if (!feed?.isPrepared) return []

  const recipe = await feedRecipeRepository.getRecipe(feedKey, conn)
  if (!recipe?.lines?.length) {
    throw new AppError(
      `«${feed.label}» está marcado como preparado pero no tiene fórmula. Configurá la fórmula en Ingredientes.`,
      400,
    )
  }

  const label = feedLabel || feed.label
  const requirements = recipe.lines
    .map((line) => ({
      ingredientKey: line.ingredientKey,
      ingredientLabel: line.ingredientLabel || line.ingredientKey,
      quantity: ingredientQtyForOutput(outputKg, line.partsPerBatch, recipe.batchSizeKg),
    }))
    .filter((r) => r.quantity > 0)

  if (requirements.length === 0) {
    throw new AppError('La fórmula no define ingredientes para descontar.', 400)
  }

  const deductions = []
  for (const req of requirements) {
    const mov = await ingredientInventoryService.applyMovement(conn, {
      ingredientKey: req.ingredientKey,
      movementType: 'production',
      quantity: req.quantity,
      notes: `Producción: ${label} (${Number(outputKg).toFixed(3)} kg)`,
      referenceType: 'feed_production',
      referenceId: feedMovementId,
      createdBy,
    })
    deductions.push(mov)
  }
 
  return deductions
}

async function previewProductionRequirements(feedKey, outputKg) {
  const feed = await feedCatalogRepository.findByKey(feedKey)
  if (!feed) throw new AppError('Alimento no encontrado.', 404)
  if (!feed.isPrepared) {
    return { isPrepared: false, lines: [], shortages: [] }
  }

  const recipe = await feedRecipeRepository.getRecipe(feedKey)
  if (!recipe?.lines?.length) {
    throw new AppError(
      `«${feed.label}» está marcado como preparado pero no tiene fórmula configurada.`,
      400,
    )
  }

  const lines = recipe.lines
    .map((line) => ({
      ingredientKey: line.ingredientKey,
      ingredientLabel: line.ingredientLabel || line.ingredientKey,
      quantity: ingredientQtyForOutput(outputKg, line.partsPerBatch, recipe.batchSizeKg),
    }))
    .filter((r) => r.quantity > 0)

  const shortages = []
  for (const req of lines) {
    const stock = await ingredientInventoryRepository.getStock(req.ingredientKey)
    const available = stock?.quantity ?? 0
    const afterStock = Math.round((available - req.quantity) * 1000) / 1000
    if (afterStock < -0.0005) {
      shortages.push({
        ingredientKey: req.ingredientKey,
        label: req.ingredientLabel,
        required: req.quantity,
        available,
        missing: Math.round((req.quantity - available) * 1000) / 1000,
        afterStock,
      })
    }
  }

  return {
    isPrepared: true,
    feedKey,
    feedLabel: feed.label,
    outputKg: Number(outputKg),
    batchSizeKg: recipe.batchSizeKg,
    lines,
    shortages,
    ok: true,
  }
}

module.exports = { deductForFeedProduction, previewProductionRequirements }
