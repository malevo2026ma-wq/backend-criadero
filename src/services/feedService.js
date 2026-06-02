const { randomUUID } = require('crypto')
const { AppError } = require('../utils/AppError')
const { daysInMonth } = require('../constants/feedCatalog')
const { pool } = require('../config/db')
const feedRepository = require('../models/feedRepository')
const feedCatalogService = require('./feedCatalogService')
const feedInventoryService = require('./feedInventoryService')

async function getFeedTypes(activeOnly = true) {
  return feedCatalogService.loadFeedTypes({ activeOnly })
}

function emptyOpeningBalances(feedTypes) {
  const o = {}
  for (const f of feedTypes) {
    o[f.key] = 0
  }
  return o
}

function buildGrid(month, feedTypes, openingBalances, entries) {
  const dim = daysInMonth(month.year, month.month)
  const keys = feedTypes.map((f) => f.key)
  const byDayFeed = {}
  for (let d = 1; d <= dim; d += 1) {
    byDayFeed[d] = {}
    for (const key of keys) {
      byDayFeed[d][key] = 0
    }
  }

  const entryCountByDayFeed = {}
  const keySet = new Set(keys)
  for (const e of entries) {
    if (e.dayOfMonth < 1 || e.dayOfMonth > dim) continue
    if (!byDayFeed[e.dayOfMonth]) continue
    if (!keySet.has(e.feedKey)) continue
    byDayFeed[e.dayOfMonth][e.feedKey] = (byDayFeed[e.dayOfMonth][e.feedKey] || 0) + e.quantity
    const ck = `${e.dayOfMonth}:${e.feedKey}`
    entryCountByDayFeed[ck] = (entryCountByDayFeed[ck] || 0) + 1
  }

  const days = []
  let grandTotal = 0
  const columnTotals = {}
  for (const f of feedTypes) {
    columnTotals[f.key] = 0
  }

  for (let d = 1; d <= dim; d += 1) {
    const feeds = { ...byDayFeed[d] }
    let rowTotal = 0
    for (const f of feedTypes) {
      const v = feeds[f.key] || 0
      rowTotal += v
      columnTotals[f.key] += v
    }
    grandTotal += rowTotal
    days.push({
      day: d,
      feeds,
      rowTotal,
      entryCounts: feedTypes.reduce((acc, f) => {
        acc[f.key] = entryCountByDayFeed[`${d}:${f.key}`] || 0
        return acc
      }, {}),
    })
  }

  return {
    daysInMonth: dim,
    days,
    columnTotals,
    grandTotal,
    openingBalances: { ...emptyOpeningBalances(feedTypes), ...openingBalances },
  }
}

async function getCatalog() {
  const feedTypes = await getFeedTypes(true)
  return { feedTypes }
}

async function listMonths() {
  return feedRepository.listMonths()
}

async function getOrCreateMonth(year, month, { createIfMissing = true } = {}) {
  if (month < 1 || month > 12) {
    throw new AppError('Mes inválido (1–12).', 400)
  }
  if (year < 2000 || year > 2100) {
    throw new AppError('Año inválido.', 400)
  }

  const feedTypes = await getFeedTypes(true)

  let row = await feedRepository.findMonthByYearMonth(year, month)
  if (!row && createIfMissing) {
    const id = randomUUID()
    await feedRepository.insertMonth(null, { id, year, month, notes: null })
    row = await feedRepository.findMonthById(id)
    for (const f of feedTypes) {
      await feedRepository.upsertOpeningBalance(null, id, f.key, 0)
    }
  }
  if (!row) {
    throw new AppError('Planilla del mes no encontrada.', 404)
  }

  let openingBalances = await feedRepository.listOpeningBalances(row.id)
  for (const f of feedTypes) {
    if (openingBalances[f.key] === undefined) {
      await feedRepository.upsertOpeningBalance(null, row.id, f.key, 0)
    }
  }
  openingBalances = await feedRepository.listOpeningBalances(row.id)
  const entries = await feedRepository.listEntriesForMonth(row.id)
  const grid = buildGrid(row, feedTypes, openingBalances, entries)

  return {
    month: row,
    feedTypes,
    grid,
    entries,
  }
}

async function updateOpeningBalances(year, month, balances) {
  const sheet = await getOrCreateMonth(year, month, { createIfMissing: true })
  const monthId = sheet.month.id

  for (const [feedKey, rawQty] of Object.entries(balances || {})) {
    const ok = await feedCatalogService.isValidFeedKey(feedKey)
    if (!ok) continue
    const qty = Number(rawQty)
    if (!Number.isFinite(qty) || qty < 0) {
      throw new AppError(`Saldo anterior inválido para ${feedKey}.`, 400)
    }
    await feedRepository.upsertOpeningBalance(null, monthId, feedKey, qty)
  }

  return getOrCreateMonth(year, month, { createIfMissing: false })
}

async function addEntry(year, month, body) {
  const sheet = await getOrCreateMonth(year, month, { createIfMissing: true })
  const dim = daysInMonth(year, month)

  const day = Number(body.dayOfMonth)
  if (!Number.isInteger(day) || day < 1 || day > dim) {
    throw new AppError(`Día inválido para este mes (1–${dim}).`, 400)
  }

  const feedKey = String(body.feedKey || '').trim()
  if (!(await feedCatalogService.isValidFeedKey(feedKey))) {
    throw new AppError('Tipo de alimento inválido.', 400)
  }

  const quantity = Number(body.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('La cantidad debe ser un número mayor a cero.', 400)
  }

  const id = randomUUID()
  const entryRow = {
    id,
    monthId: sheet.month.id,
    dayOfMonth: day,
    feedKey,
    quantity,
    notes: body.notes != null ? String(body.notes).trim() : '',
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await feedRepository.insertEntry(conn, {
      ...entryRow,
      notes: entryRow.notes || null,
    })
    await feedInventoryService.syncConsumptionEntry(conn, 'create', entryRow)
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  const entry = await feedRepository.findEntryById(id)
  return { entry, sheet: await getOrCreateMonth(year, month, { createIfMissing: false }) }
}

async function updateEntry(entryId, body) {
  const existing = await feedRepository.findEntryById(entryId)
  if (!existing) {
    throw new AppError('Registro de consumo no encontrado.', 404)
  }

  const month = await feedRepository.findMonthById(existing.monthId)
  if (!month) {
    throw new AppError('Planilla del mes no encontrada.', 404)
  }

  const dim = daysInMonth(month.year, month.month)
  const fields = {}

  if (body.dayOfMonth !== undefined) {
    const day = Number(body.dayOfMonth)
    if (!Number.isInteger(day) || day < 1 || day > dim) {
      throw new AppError(`Día inválido (1–${dim}).`, 400)
    }
    fields.dayOfMonth = day
  }

  if (body.feedKey !== undefined) {
    const feedKey = String(body.feedKey).trim()
    if (!(await feedCatalogService.isValidFeedKey(feedKey))) {
      throw new AppError('Tipo de alimento inválido.', 400)
    }
    fields.feedKey = feedKey
  }

  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError('La cantidad debe ser mayor a cero.', 400)
    }
    fields.quantity = quantity
  }

  if (body.notes !== undefined) {
    fields.notes = body.notes != null ? String(body.notes).trim() : ''
  }

  const updatedEntry = { ...existing, ...fields }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await feedRepository.updateEntry(entryId, fields, conn)
    await feedInventoryService.syncConsumptionEntry(conn, 'update', updatedEntry, existing)
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  const entry = await feedRepository.findEntryById(entryId)
  const sheet = await getOrCreateMonth(month.year, month.month, { createIfMissing: false })
  return { entry, sheet }
}

async function removeEntry(entryId) {
  const existing = await feedRepository.findEntryById(entryId)
  if (!existing) {
    throw new AppError('Registro de consumo no encontrado.', 404)
  }
  const month = await feedRepository.findMonthById(existing.monthId)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await feedInventoryService.syncConsumptionEntry(conn, 'delete', existing, existing)
    await feedRepository.deleteEntry(entryId, conn)
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  if (!month) {
    return { sheet: null }
  }
  const sheet = await getOrCreateMonth(month.year, month.month, { createIfMissing: false })
  return { sheet }
}

async function getHistory(year, month, filters = {}) {
  const sheet = await getOrCreateMonth(year, month, { createIfMissing: false }).catch((e) => {
    if (e.statusCode === 404) return null
    throw e
  })
  if (!sheet) {
    return { month: null, entries: [], summary: [] }
  }

  let entries = sheet.entries
  if (filters.dayOfMonth != null) {
    const d = Number(filters.dayOfMonth)
    entries = entries.filter((e) => e.dayOfMonth === d)
  }
  if (filters.feedKey) {
    const fk = String(filters.feedKey).trim()
    entries = entries.filter((e) => e.feedKey === fk)
  }

  entries = [...entries].sort((a, b) => {
    if (a.dayOfMonth !== b.dayOfMonth) return a.dayOfMonth - b.dayOfMonth
    if (a.feedKey !== b.feedKey) return a.feedKey.localeCompare(b.feedKey)
    return new Date(a.createdAt) - new Date(b.createdAt)
  })

  const summaryMap = new Map()
  for (const e of entries) {
    const key = `${e.dayOfMonth}:${e.feedKey}`
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        dayOfMonth: e.dayOfMonth,
        feedKey: e.feedKey,
        entryCount: 0,
        totalQuantity: 0,
      })
    }
    const s = summaryMap.get(key)
    s.entryCount += 1
    s.totalQuantity += e.quantity
  }

  return {
    month: sheet.month,
    entries,
    summary: [...summaryMap.values()].sort((a, b) => {
      if (a.dayOfMonth !== b.dayOfMonth) return a.dayOfMonth - b.dayOfMonth
      return a.feedKey.localeCompare(b.feedKey)
    }),
  }
}

module.exports = {
  getCatalog,
  listMonths,
  getOrCreateMonth,
  updateOpeningBalances,
  addEntry,
  updateEntry,
  removeEntry,
  getHistory,
}
