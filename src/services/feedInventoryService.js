const { randomUUID } = require('crypto')
const { AppError } = require('../utils/AppError')
const { pool } = require('../config/db')
const feedInventoryRepository = require('../models/feedInventoryRepository')
const feedCatalogRepository = require('../models/feedCatalogRepository')
const feedCatalogService = require('./feedCatalogService')
const feedProductionService = require('./feedProductionService')

const MOVEMENT_LABELS = {
  in: 'Entrada',
  out: 'Salida manual',
  adjust: 'Ajuste',
  consumption: 'Consumo (planilla)',
}

async function getOverview() {
  await feedCatalogService.ensureCatalogReady()
  const types = await feedCatalogService.loadFeedTypes({ activeOnly: false })
  const stocks = await feedInventoryRepository.listAllStock()
  const stockMap = Object.fromEntries(stocks.map((s) => [s.feedKey, s.quantity]))

  const recipeSummaries = await feedCatalogService.listRecipeFlagsForFeeds()

  return {
    items: types.map((t) => ({
      ...t,
      stock: stockMap[t.key] ?? 0,
      lowStock: (stockMap[t.key] ?? 0) <= 0,
      isPrepared: Boolean(t.isPrepared),
      hasRecipe: recipeSummaries.get(t.key)?.hasRecipe ?? false,
    })),
  }
}

async function applyMovement(
  conn,
  {
    feedKey,
    movementType,
    quantity,
    notes,
    referenceType,
    referenceId,
    createdBy,
    targetStock,
  },
) {
  const valid = await feedCatalogService.isValidFeedKey(feedKey, { allowInactive: true })
  if (!valid) throw new AppError('Tipo de alimento inválido.', 400)

  await feedInventoryRepository.ensureStockRow(conn, feedKey)
  const current = await feedInventoryRepository.getStock(feedKey, conn)
  const before = current?.quantity ?? 0
  let after = before
  let magnitude = Number(quantity)

  switch (movementType) {
    case 'in':
      if (!Number.isFinite(magnitude) || magnitude <= 0) {
        throw new AppError('La cantidad de entrada debe ser mayor a cero.', 400)
      }
      after = before + magnitude
      break
    case 'out':
      if (!Number.isFinite(magnitude) || magnitude <= 0) {
        throw new AppError('La cantidad de salida debe ser mayor a cero.', 400)
      }
      after = before - magnitude
      break
    case 'consumption':
      if (!Number.isFinite(magnitude) || magnitude <= 0) {
        throw new AppError('Cantidad de consumo inválida.', 400)
      }
      after = before - magnitude
      break
    case 'adjust': {
      const target = targetStock != null ? Number(targetStock) : Number(quantity)
      if (!Number.isFinite(target)) {
        throw new AppError('Stock objetivo inválido.', 400)
      }
      magnitude = Math.abs(target - before)
      after = target
      break
    }
    default:
      throw new AppError('Tipo de movimiento inválido.', 400)
  }

  await feedInventoryRepository.upsertStock(conn, feedKey, after)
  const id = randomUUID()
  await feedInventoryRepository.insertMovement(conn, {
    id,
    feedKey,
    movementType,
    quantity: magnitude,
    stockBefore: before,
    stockAfter: after,
    notes: notes || null,
    referenceType: referenceType || null,
    referenceId: referenceId || null,
    createdBy: createdBy || null,
  })

  let ingredientDeductions = []
  if (movementType === 'in') {
    const feed = await feedCatalogRepository.findByKey(feedKey, conn)
    if (feed?.isPrepared) {
      ingredientDeductions = await feedProductionService.deductForFeedProduction(conn, {
        feedKey,
        outputKg: magnitude,
        feedMovementId: id,
        feedLabel: feed.label,
        createdBy,
      })
    }
  }

  return {
    id,
    feedKey,
    movementType,
    quantity: magnitude,
    stockBefore: before,
    stockAfter: after,
    movementLabel: MOVEMENT_LABELS[movementType],
    ingredientDeductions,
  }
}

async function createManualMovement(body, userId) {
  const feedKey = String(body.feedKey || '').trim()
  const movementType = String(body.movementType || '').trim()

  if (!['in', 'out', 'adjust'].includes(movementType)) {
    throw new AppError('Tipo de movimiento inválido.', 400)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await applyMovement(conn, {
      feedKey,
      movementType,
      quantity: body.quantity,
      targetStock: body.targetStock,
      notes: body.notes,
      createdBy: userId,
    })
    await conn.commit()
    return result
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

async function reverseConsumptionReference(conn, referenceId) {
  const mov = await feedInventoryRepository.findMovementByReference(
    'feed_consumption',
    referenceId,
    conn,
  )
  if (!mov) return

  const stock = await feedInventoryRepository.getStock(mov.feedKey, conn)
  const before = stock?.quantity ?? 0
  const after = before + mov.quantity
  await feedInventoryRepository.upsertStock(conn, mov.feedKey, after)
  await feedInventoryRepository.deleteMovementById(mov.id, conn)
}

async function syncConsumptionEntry(conn, action, entry, previousEntry = null) {
  if (!entry) return

  if (action === 'delete' || action === 'update') {
    const refId = previousEntry?.id || entry.id
    await reverseConsumptionReference(conn, refId)
  }

  if (action === 'delete') return

  const target = action === 'update' ? entry : entry
  await applyMovement(conn, {
    feedKey: target.feedKey,
    movementType: 'consumption',
    quantity: target.quantity,
    notes: `Consumo planilla — día ${target.dayOfMonth}`,
    referenceType: 'feed_consumption',
    referenceId: target.id,
    createdBy: null,
  })
}

async function listMovements(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200)
  const offset = Math.max(Number(filters.offset) || 0, 0)
  const feedKey = filters.feedKey ? String(filters.feedKey).trim() : undefined

  const [items, total] = await Promise.all([
    feedInventoryRepository.listMovements({ feedKey, limit, offset }),
    feedInventoryRepository.countMovements({ feedKey }),
  ])

  return {
    items: items.map((m) => ({
      ...m,
      movementLabel: MOVEMENT_LABELS[m.movementType] || m.movementType,
    })),
    total,
    limit,
    offset,
  }
}

module.exports = {
  getOverview,
  createManualMovement,
  syncConsumptionEntry,
  listMovements,
  MOVEMENT_LABELS,
}
