const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapMovementRow(row) {
  if (!row) return null
  return {
    id: row.id,
    feedKey: row.feed_key,
    movementType: row.movement_type,
    quantity: Number(row.quantity),
    stockBefore: Number(row.stock_before),
    stockAfter: Number(row.stock_after),
    notes: row.notes ?? '',
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

async function getStock(feedKey, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT feed_key, quantity, updated_at FROM feed_inventory_stock WHERE feed_key = ? LIMIT 1`,
    [feedKey],
  )
  if (!rows[0]) return null
  return {
    feedKey: rows[0].feed_key,
    quantity: Number(rows[0].quantity),
    updatedAt: rows[0].updated_at,
  }
}

async function listAllStock(conn = null) {
  const [rows] = await q(conn).query(
    `SELECT feed_key, quantity, updated_at FROM feed_inventory_stock ORDER BY feed_key ASC`,
  )
  return rows.map((r) => ({
    feedKey: r.feed_key,
    quantity: Number(r.quantity),
    updatedAt: r.updated_at,
  }))
}

async function upsertStock(conn, feedKey, quantity) {
  await q(conn).query(
    `INSERT INTO feed_inventory_stock (feed_key, quantity) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
    [feedKey, quantity],
  )
}

async function ensureStockRow(conn, feedKey) {
  await q(conn).query(
    `INSERT IGNORE INTO feed_inventory_stock (feed_key, quantity) VALUES (?, 0)`,
    [feedKey],
  )
}

async function insertMovement(conn, row) {
  await q(conn).query(
    `INSERT INTO feed_inventory_movements
     (id, feed_key, movement_type, quantity, stock_before, stock_after, notes, reference_type, reference_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.feedKey,
      row.movementType,
      row.quantity,
      row.stockBefore,
      row.stockAfter,
      row.notes || null,
      row.referenceType || null,
      row.referenceId || null,
      row.createdBy || null,
    ],
  )
}

async function findMovementByReference(referenceType, referenceId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT * FROM feed_inventory_movements
     WHERE reference_type = ? AND reference_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [referenceType, referenceId],
  )
  return mapMovementRow(rows[0])
}

async function deleteMovementById(movementId, conn = null) {
  const [r] = await q(conn).query(`DELETE FROM feed_inventory_movements WHERE id = ?`, [movementId])
  return r.affectedRows > 0
}

async function listMovements(
  { feedKey, limit = 50, offset = 0 } = {},
  conn = null,
) {
  const clauses = []
  const vals = []
  if (feedKey) {
    clauses.push('m.feed_key = ?')
    vals.push(feedKey)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  vals.push(limit, offset)
  const [rows] = await q(conn).query(
    `SELECT m.*, c.label AS feed_label, c.short_label AS feed_short_label
     FROM feed_inventory_movements m
     LEFT JOIN feed_catalog c ON c.feed_key = m.feed_key
     ${where}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    vals,
  )
  return rows.map((row) => ({
    ...mapMovementRow(row),
    feedLabel: row.feed_label,
    feedShortLabel: row.feed_short_label,
  }))
}

async function countMovements({ feedKey } = {}, conn = null) {
  const clauses = []
  const vals = []
  if (feedKey) {
    clauses.push('feed_key = ?')
    vals.push(feedKey)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const [rows] = await q(conn).query(
    `SELECT COUNT(*) AS c FROM feed_inventory_movements ${where}`,
    vals,
  )
  return Number(rows[0]?.c || 0)
}

module.exports = {
  getStock,
  listAllStock,
  upsertStock,
  ensureStockRow,
  insertMovement,
  findMovementByReference,
  deleteMovementById,
  listMovements,
  countMovements,
}
