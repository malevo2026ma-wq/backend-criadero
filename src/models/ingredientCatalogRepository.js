const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    key: row.ingredient_key,
    label: row.label,
    shortLabel: row.short_label,
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listAll(conn = null, { activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : ''
  const [rows] = await q(conn).query(
    `SELECT * FROM ingredient_catalog ${where} ORDER BY sort_order ASC, label ASC`,
  )
  return rows.map(mapRow)
}

async function findByKey(ingredientKey, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT * FROM ingredient_catalog WHERE ingredient_key = ? LIMIT 1`,
    [ingredientKey],
  )
  return mapRow(rows[0])
}

async function insert(conn, row) {
  await q(conn).query(
    `INSERT INTO ingredient_catalog (id, ingredient_key, label, short_label, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.ingredientKey, row.label, row.shortLabel, row.sortOrder, row.active ? 1 : 0],
  )
}

async function updateByKey(conn, ingredientKey, fields) {
  const parts = []
  const vals = []
  if (fields.label !== undefined) {
    parts.push('label = ?')
    vals.push(fields.label)
  }
  if (fields.shortLabel !== undefined) {
    parts.push('short_label = ?')
    vals.push(fields.shortLabel)
  }
  if (fields.sortOrder !== undefined) {
    parts.push('sort_order = ?')
    vals.push(fields.sortOrder)
  }
  if (fields.active !== undefined) {
    parts.push('active = ?')
    vals.push(fields.active ? 1 : 0)
  }
  if (parts.length === 0) return false
  vals.push(ingredientKey)
  const [r] = await q(conn).query(
    `UPDATE ingredient_catalog SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE ingredient_key = ?`,
    vals,
  )
  return r.affectedRows > 0
}

async function countByKey(ingredientKey, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT COUNT(*) AS c FROM ingredient_catalog WHERE ingredient_key = ?`,
    [ingredientKey],
  )
  return Number(rows[0]?.c || 0)
}

module.exports = {
  listAll,
  findByKey,
  insert,
  updateByKey,
  countByKey,
}
