const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    key: row.feed_key,
    label: row.label,
    shortLabel: row.short_label,
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
    isPrepared: Boolean(row.is_prepared),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listAll(conn = null, { activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : ''
  const [rows] = await q(conn).query(
    `SELECT * FROM feed_catalog ${where} ORDER BY sort_order ASC, label ASC`,
  )
  return rows.map(mapRow)
}

async function findByKey(feedKey, conn = null) {
  const [rows] = await q(conn).query(`SELECT * FROM feed_catalog WHERE feed_key = ? LIMIT 1`, [
    feedKey,
  ])
  return mapRow(rows[0])
}

async function insert(conn, row) {
  await q(conn).query(
    `INSERT INTO feed_catalog (id, feed_key, label, short_label, sort_order, active, is_prepared)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.feedKey,
      row.label,
      row.shortLabel,
      row.sortOrder,
      row.active ? 1 : 0,
      row.isPrepared ? 1 : 0,
    ],
  )
}

async function updateByKey(conn, feedKey, fields) {
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
  if (fields.isPrepared !== undefined) {
    parts.push('is_prepared = ?')
    vals.push(fields.isPrepared ? 1 : 0)
  }
  if (parts.length === 0) return false
  vals.push(feedKey)
  const [r] = await q(conn).query(
    `UPDATE feed_catalog SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE feed_key = ?`,
    vals,
  )
  return r.affectedRows > 0
}

async function countByKey(feedKey, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT COUNT(*) AS c FROM feed_catalog WHERE feed_key = ?`,
    [feedKey],
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
