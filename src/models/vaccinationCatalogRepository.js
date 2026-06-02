const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapCatalogRow(row) {
  if (!row) return null
  return {
    id: row.id,
    key: row.vaccine_key,
    vaccineKey: row.vaccine_key,
    category: row.category,
    sortOrder: Number(row.sort_order) || 0,
    label: row.label,
    doseText: row.dose_text ?? '',
    isOptional: Boolean(row.is_optional),
    anchor: row.anchor,
    dayOffset: Number(row.day_offset) || 0,
    windowEndOffset: row.window_end_offset != null ? Number(row.window_end_offset) : null,
    active: Boolean(row.active),
  }
}

/** Formato compatible con sync y constants (key + camelCase). */
function toCatalogItem(row) {
  const m = mapCatalogRow(row)
  return {
    key: m.key,
    category: m.category,
    sortOrder: m.sortOrder,
    label: m.label,
    doseText: m.doseText,
    isOptional: m.isOptional,
    anchor: m.anchor,
    dayOffset: m.dayOffset,
    windowEndOffset: m.windowEndOffset,
  }
}

async function listAll(conn, { activeOnly = false } = {}) {
  let sql = `SELECT * FROM vaccination_catalog`
  const params = []
  if (activeOnly) {
    sql += ` WHERE active = 1`
  }
  sql += ` ORDER BY category ASC, sort_order ASC, vaccine_key ASC`
  const [rows] = await q(conn).query(sql, params)
  return rows.map(mapCatalogRow)
}

async function listActiveCatalog(conn) {
  const [rows] = await q(conn).query(
    `SELECT * FROM vaccination_catalog WHERE active = 1 ORDER BY category ASC, sort_order ASC, vaccine_key ASC`,
  )
  return rows.map(toCatalogItem)
}

async function findByKey(conn, vaccineKey) {
  const [rows] = await q(conn).query(
    `SELECT * FROM vaccination_catalog WHERE vaccine_key = ? LIMIT 1`,
    [vaccineKey],
  )
  return mapCatalogRow(rows[0])
}

async function insertRow(conn, row) {
  await q(conn).query(
    `INSERT INTO vaccination_catalog (
      id, vaccine_key, category, sort_order, label, dose_text, is_optional, anchor, day_offset, window_end_offset, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.vaccineKey,
      row.category,
      row.sortOrder,
      row.label,
      row.doseText ?? null,
      row.isOptional ? 1 : 0,
      row.anchor,
      row.dayOffset,
      row.windowEndOffset != null ? row.windowEndOffset : null,
      row.active !== false ? 1 : 0,
    ],
  )
}

async function updateByKey(conn, vaccineKey, fields) {
  const parts = []
  const vals = []
  if (fields.category !== undefined) {
    parts.push('category = ?')
    vals.push(fields.category)
  }
  if (fields.sortOrder !== undefined) {
    parts.push('sort_order = ?')
    vals.push(fields.sortOrder)
  }
  if (fields.label !== undefined) {
    parts.push('label = ?')
    vals.push(fields.label)
  }
  if (fields.doseText !== undefined) {
    parts.push('dose_text = ?')
    vals.push(fields.doseText || null)
  }
  if (fields.isOptional !== undefined) {
    parts.push('is_optional = ?')
    vals.push(fields.isOptional ? 1 : 0)
  }
  if (fields.anchor !== undefined) {
    parts.push('anchor = ?')
    vals.push(fields.anchor)
  }
  if (fields.dayOffset !== undefined) {
    parts.push('day_offset = ?')
    vals.push(fields.dayOffset)
  }
  if (fields.windowEndOffset !== undefined) {
    parts.push('window_end_offset = ?')
    vals.push(fields.windowEndOffset)
  }
  if (fields.active !== undefined) {
    parts.push('active = ?')
    vals.push(fields.active ? 1 : 0)
  }
  if (parts.length === 0) return false
  vals.push(vaccineKey)
  const [r] = await q(conn).query(
    `UPDATE vaccination_catalog SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE vaccine_key = ?`,
    vals,
  )
  return r.affectedRows > 0
}

async function deleteByKeyHard(conn, vaccineKey) {
  const [r] = await q(conn).query(`DELETE FROM vaccination_catalog WHERE vaccine_key = ?`, [vaccineKey])
  return r.affectedRows > 0
}

module.exports = {
  listAll,
  listActiveCatalog,
  findByKey,
  insertRow,
  updateByKey,
  deleteByKeyHard,
  mapCatalogRow,
  toCatalogItem,
}
