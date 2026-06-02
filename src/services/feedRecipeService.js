const { randomUUID } = require('crypto')
const { AppError } = require('../utils/AppError')
const { pool } = require('../config/db')
const feedCatalogRepository = require('../models/feedCatalogRepository')
const feedRecipeRepository = require('../models/feedRecipeRepository')
const ingredientCatalogService = require('./ingredientCatalogService')
const { roundQtyKg } = require('../utils/inventoryQty')

async function listRecipes() {
  return feedRecipeRepository.listRecipesSummary()
}

async function getRecipe(feedKey) {
  const feed = await feedCatalogRepository.findByKey(feedKey)
  if (!feed) throw new AppError('Alimento no encontrado.', 404)
  const recipe = await feedRecipeRepository.getRecipe(feedKey)
  return {
    feedKey,
    feedLabel: feed.label,
    isPrepared: feed.isPrepared,
    batchSizeKg: recipe?.batchSizeKg ?? 1000,
    lines: recipe?.lines ?? [],
  }
}

async function saveRecipe(feedKey, body) {
  const feed = await feedCatalogRepository.findByKey(feedKey)
  if (!feed) throw new AppError('Alimento no encontrado.', 404)

  const isPrepared =
    body.isPrepared !== undefined ? Boolean(body.isPrepared) : Boolean(feed.isPrepared)

  const batchSizeKg = roundQtyKg(body.batchSizeKg ?? 1000)
  if (batchSizeKg <= 0) throw new AppError('El tamaño de lote debe ser mayor a cero.', 400)

  const lines = Array.isArray(body.lines) ? body.lines : []
  const normalized = []
  const seen = new Set()

  if (isPrepared) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const ingredientKey = String(line.ingredientKey || '').trim()
      if (!ingredientKey) continue
      if (seen.has(ingredientKey)) {
        throw new AppError(`Ingrediente duplicado en la fórmula: ${ingredientKey}.`, 400)
      }
      seen.add(ingredientKey)

      const valid = await ingredientCatalogService.isValidIngredientKey(ingredientKey, {
        allowInactive: true,
      })
      if (!valid) throw new AppError(`Ingrediente inválido: ${ingredientKey}.`, 400)

      const parts = roundQtyKg(line.partsPerBatch)
      if (parts < 0) throw new AppError('Las partes por lote no pueden ser negativas.', 400)

      normalized.push({
        id: randomUUID(),
        feedKey,
        ingredientKey,
        partsPerBatch: parts,
        sortOrder: Number.isFinite(Number(line.sortOrder)) ? Number(line.sortOrder) : i * 10,
      })
    }

    if (normalized.length === 0) {
      throw new AppError(
        'Un alimento preparado debe tener al menos un ingrediente en la fórmula.',
        400,
      )
    }
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await feedCatalogRepository.updateByKey(conn, feedKey, { isPrepared })

    if (!isPrepared) {
      await feedRecipeRepository.deleteLinesForFeed(conn, feedKey)
    } else {
      await feedRecipeRepository.upsertRecipeHeader(conn, feedKey, batchSizeKg)
      await feedRecipeRepository.deleteLinesForFeed(conn, feedKey)
      for (const line of normalized) {
        await feedRecipeRepository.insertLine(conn, line)
      }
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  return getRecipe(feedKey)
}

module.exports = {
  listRecipes,
  getRecipe,
  saveRecipe,
}
