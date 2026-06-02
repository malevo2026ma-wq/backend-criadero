const { randomUUID } = require('crypto')
const { AppError } = require('../utils/AppError')
const { pool } = require('../config/db')
const ingredientCatalogRepository = require('../models/ingredientCatalogRepository')
const ingredientInventoryRepository = require('../models/ingredientInventoryRepository')

function slugifyIngredientKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

async function createIngredientType(body) {
  const label = String(body.label || '').trim()
  if (!label) throw new AppError('El nombre del ingrediente es obligatorio.', 400)

  let ingredientKey = body.ingredientKey
    ? String(body.ingredientKey).trim().toLowerCase()
    : slugifyIngredientKey(label)
  if (!ingredientKey || ingredientKey.length < 2) {
    throw new AppError('Clave de ingrediente inválida.', 400)
  }
  if (!/^[a-z0-9_]+$/.test(ingredientKey)) {
    throw new AppError('La clave solo puede tener letras minúsculas, números y guión bajo.', 400)
  }

  const exists = await ingredientCatalogRepository.countByKey(ingredientKey)
  if (exists > 0) throw new AppError('Ya existe un ingrediente con esa clave.', 409)

  const shortLabel = String(body.shortLabel || label).trim().slice(0, 48)
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 200

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await ingredientCatalogRepository.insert(conn, {
      id: randomUUID(),
      ingredientKey,
      label,
      shortLabel,
      sortOrder,
      active: true,
    })
    await ingredientInventoryRepository.ensureStockRow(conn, ingredientKey)
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  return ingredientCatalogRepository.findByKey(ingredientKey)
}

async function updateIngredientType(ingredientKey, body) {
  const existing = await ingredientCatalogRepository.findByKey(ingredientKey)
  if (!existing) throw new AppError('Ingrediente no encontrado.', 404)

  const fields = {}
  if (body.label !== undefined) {
    const label = String(body.label).trim()
    if (!label) throw new AppError('El nombre no puede estar vacío.', 400)
    fields.label = label
  }
  if (body.shortLabel !== undefined) {
    fields.shortLabel = String(body.shortLabel).trim().slice(0, 48) || existing.label
  }
  if (body.sortOrder !== undefined) {
    fields.sortOrder = Number(body.sortOrder)
  }
  if (body.active !== undefined) {
    fields.active = Boolean(body.active)
  }

  await ingredientCatalogRepository.updateByKey(null, ingredientKey, fields)
  return ingredientCatalogRepository.findByKey(ingredientKey)
}

async function isValidIngredientKey(key, { allowInactive = false } = {}) {
  const k = String(key || '').trim()
  if (!k) return false
  const item = await ingredientCatalogRepository.findByKey(k)
  if (!item) return false
  return allowInactive || item.active
}

module.exports = {
  createIngredientType,
  updateIngredientType,
  isValidIngredientKey,
  slugifyIngredientKey,
}
