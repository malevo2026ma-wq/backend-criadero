const { randomUUID } = require('crypto')
const { AppError } = require('../utils/AppError')
const { FEED_TYPES: DEFAULT_FEED_TYPES } = require('../constants/feedCatalog')
const feedCatalogRepository = require('../models/feedCatalogRepository')
const feedInventoryRepository = require('../models/feedInventoryRepository')
const feedRecipeRepository = require('../models/feedRecipeRepository')
const { pool } = require('../config/db')

let catalogCache = null
let catalogKeysCache = null

function invalidateCache() {
  catalogCache = null
  catalogKeysCache = null
}

async function seedFromDefaults(conn) {
  for (const f of DEFAULT_FEED_TYPES) {
    const exists = await feedCatalogRepository.countByKey(f.key, conn)
    if (exists > 0) continue
    await feedCatalogRepository.insert(conn, {
      id: randomUUID(),
      feedKey: f.key,
      label: f.label,
      shortLabel: f.shortLabel,
      sortOrder: f.sortOrder,
      active: true,
      isPrepared: false,
    })
    await feedInventoryRepository.ensureStockRow(conn, f.key)
  }
}

async function ensureCatalogReady(conn = null) {
  const rows = await feedCatalogRepository.listAll(conn, { activeOnly: false })
  if (rows.length === 0) {
    const c = conn || (await pool.getConnection())
    const ownConn = !conn
    try {
      if (ownConn) await c.beginTransaction()
      await seedFromDefaults(c)
      if (ownConn) await c.commit()
    } catch (e) {
      if (ownConn) await c.rollback()
      throw e
    } finally {
      if (ownConn) c.release()
    }
  }
}

async function loadFeedTypes({ activeOnly = true, useCache = true } = {}) {
  await ensureCatalogReady()
  if (useCache && catalogCache && (!activeOnly || catalogCache.activeOnly)) {
    const list = activeOnly ? catalogCache.all.filter((f) => f.active) : catalogCache.all
    return list
  }
  const all = await feedCatalogRepository.listAll(null, { activeOnly: false })
  catalogCache = { all, activeOnly: false }
  catalogKeysCache = new Set(all.map((f) => f.key))
  const list = activeOnly ? all.filter((f) => f.active) : all
  return list
}

async function isValidFeedKey(key, { allowInactive = false } = {}) {
  await ensureCatalogReady()
  const k = String(key || '').trim()
  if (!k) return false
  if (!catalogKeysCache) {
    await loadFeedTypes({ activeOnly: false, useCache: false })
  }
  if (!catalogKeysCache.has(k)) return false
  if (allowInactive) return true
  const item = catalogCache?.all?.find((f) => f.key === k)
  return item ? item.active : false
}

async function getActiveFeedKeys() {
  const types = await loadFeedTypes({ activeOnly: true })
  return new Set(types.map((f) => f.key))
}

function slugifyFeedKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

async function createFeedType(body) {
  const label = String(body.label || '').trim()
  if (!label) throw new AppError('El nombre del alimento es obligatorio.', 400)

  let feedKey = body.feedKey ? String(body.feedKey).trim().toLowerCase() : slugifyFeedKey(label)
  if (!feedKey || feedKey.length < 2) {
    throw new AppError('Clave de alimento inválida.', 400)
  }
  if (!/^[a-z0-9_]+$/.test(feedKey)) {
    throw new AppError('La clave solo puede tener letras minúsculas, números y guión bajo.', 400)
  }

  const exists = await feedCatalogRepository.countByKey(feedKey)
  if (exists > 0) throw new AppError('Ya existe un alimento con esa clave.', 409)

  const shortLabel = String(body.shortLabel || label).trim().slice(0, 40)
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await feedCatalogRepository.insert(conn, {
      id: randomUUID(),
      feedKey,
      label,
      shortLabel,
      sortOrder,
      active: true,
      isPrepared: Boolean(body.isPrepared),
    })
    await feedInventoryRepository.ensureStockRow(conn, feedKey)
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  invalidateCache()
  return feedCatalogRepository.findByKey(feedKey)
}

async function updateFeedType(feedKey, body) {
  const existing = await feedCatalogRepository.findByKey(feedKey)
  if (!existing) throw new AppError('Alimento no encontrado.', 404)

  const fields = {}
  if (body.label !== undefined) {
    const label = String(body.label).trim()
    if (!label) throw new AppError('El nombre no puede estar vacío.', 400)
    fields.label = label
  }
  if (body.shortLabel !== undefined) {
    fields.shortLabel = String(body.shortLabel).trim().slice(0, 40) || existing.label
  }
  if (body.sortOrder !== undefined) {
    fields.sortOrder = Number(body.sortOrder)
  }
  if (body.active !== undefined) {
    fields.active = Boolean(body.active)
  }
  if (body.isPrepared !== undefined) {
    fields.isPrepared = Boolean(body.isPrepared)
  }

  await feedCatalogRepository.updateByKey(null, feedKey, fields)
  invalidateCache()
  return feedCatalogRepository.findByKey(feedKey)
}

async function listRecipeFlagsForFeeds() {
  const rows = await feedRecipeRepository.listRecipesSummary()
  return new Map(
    rows.map((r) => [r.feedKey, { hasRecipe: r.hasRecipe, lineCount: r.lineCount }]),
  )
}

module.exports = {
  loadFeedTypes,
  isValidFeedKey,
  getActiveFeedKeys,
  createFeedType,
  updateFeedType,
  invalidateCache,
  ensureCatalogReady,
  slugifyFeedKey,
  listRecipeFlagsForFeeds,
}
