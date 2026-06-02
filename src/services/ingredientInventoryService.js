const { randomUUID } = require('crypto')
const { AppError } = require('../utils/AppError')
const { pool } = require('../config/db')
const ingredientCatalogRepository = require('../models/ingredientCatalogRepository')
const ingredientInventoryRepository = require('../models/ingredientInventoryRepository')

const MOVEMENT_LABELS = {
  in: 'Entrada',
  out: 'Salida manual',
  adjust: 'Ajuste',
  production: 'Producción de alimento',
}

async function getOverview() {
  const types = await ingredientCatalogRepository.listAll(null, { activeOnly: false })
  const stocks = await ingredientInventoryRepository.listAllStock()
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ingredientKey, s.quantity]))

  return {
    items: types.map((t) => ({
      ...t,
      stock: stockMap[t.key] ?? 0,
      lowStock: (stockMap[t.key] ?? 0) <= 0,
    })),
  }
}

async function applyMovement(
  conn,
  {
    ingredientKey,
    movementType,
    quantity,
    notes,
    referenceType,
    referenceId,
    createdBy,
    targetStock,
  },
) {
  const item = await ingredientCatalogRepository.findByKey(ingredientKey, conn)
  if (!item) throw new AppError('Ingrediente inválido.', 400)

  await ingredientInventoryRepository.ensureStockRow(conn, ingredientKey)
  const current = await ingredientInventoryRepository.getStock(ingredientKey, conn)
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
    case 'production':
      if (!Number.isFinite(magnitude) || magnitude <= 0) {
        throw new AppError('La cantidad de salida debe ser mayor a cero.', 400)
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

  await ingredientInventoryRepository.upsertStock(conn, ingredientKey, after)
  const id = randomUUID()
  await ingredientInventoryRepository.insertMovement(conn, {
    id,
    ingredientKey,
    movementType,
    quantity: magnitude,
    stockBefore: before,
    stockAfter: after,
    notes: notes || null,
    referenceType: referenceType || null,
    referenceId: referenceId || null,
    createdBy: createdBy || null,
  })

  return {
    id,
    ingredientKey,
    movementType,
    quantity: magnitude,
    stockBefore: before,
    stockAfter: after,
    movementLabel: MOVEMENT_LABELS[movementType],
    ingredientLabel: item.label,
  }
}

async function createManualMovement(body, userId) {
  const ingredientKey = String(body.ingredientKey || '').trim()
  const movementType = String(body.movementType || '').trim()

  if (!['in', 'out', 'adjust'].includes(movementType)) {
    throw new AppError('Tipo de movimiento inválido.', 400)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await applyMovement(conn, {
      ingredientKey,
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

async function listMovements(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200)
  const offset = Math.max(Number(filters.offset) || 0, 0)
  const ingredientKey = filters.ingredientKey
    ? String(filters.ingredientKey).trim()
    : undefined

  const [items, total] = await Promise.all([
    ingredientInventoryRepository.listMovements({ ingredientKey, limit, offset }),
    ingredientInventoryRepository.countMovements({ ingredientKey }),
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
  applyMovement,
  createManualMovement,
  listMovements,
  MOVEMENT_LABELS,
}
