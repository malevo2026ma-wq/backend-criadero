const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapMovementRow(row) {
  if (!row) return null
  return {
    id: row.id,
    ingredientKey: row.ingredient_key,
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

async function getStock(ingredientKey, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT ingredient_key, quantity, updated_at FROM ingredient_inventory_stock WHERE ingredient_key = ? LIMIT 1`,
    [ingredientKey],
  )
  if (!rows[0]) return null
  return {
    ingredientKey: rows[0].ingredient_key,
    quantity: Number(rows[0].quantity),
    updatedAt: rows[0].updated_at,
  }
}

async function listAllStock(conn = null) {
  const [rows] = await q(conn).query(
    `SELECT ingredient_key, quantity, updated_at FROM ingredient_inventory_stock ORDER BY ingredient_key ASC`,
  )
  return rows.map((r) => ({
    ingredientKey: r.ingredient_key,
    quantity: Number(r.quantity),
    updatedAt: r.updated_at,
  }))
}

async function upsertStock(conn, ingredientKey, quantity) {
  await q(conn).query(
    `INSERT INTO ingredient_inventory_stock (ingredient_key, quantity) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
    [ingredientKey, quantity],
  )
}

async function ensureStockRow(conn, ingredientKey) {
  await q(conn).query(
    `INSERT IGNORE INTO ingredient_inventory_stock (ingredient_key, quantity) VALUES (?, 0)`,
    [ingredientKey],
  )
}

async function insertMovement(conn, row) {
  await q(conn).query(
    `INSERT INTO ingredient_inventory_movements
     (id, ingredient_key, movement_type, quantity, stock_before, stock_after, notes, reference_type, reference_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.ingredientKey,
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

async function listMovements({ ingredientKey, limit = 50, offset = 0 } = {}, conn = null) {
  const clauses = []
  const vals = []
  if (ingredientKey) {
    clauses.push('m.ingredient_key = ?')
    vals.push(ingredientKey)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  vals.push(limit, offset)
  const [rows] = await q(conn).query(
    `SELECT m.*, c.label AS ingredient_label, c.short_label AS ingredient_short_label
     FROM ingredient_inventory_movements m
     LEFT JOIN ingredient_catalog c ON c.ingredient_key = m.ingredient_key
     ${where}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    vals,
  )
  return rows.map((row) => ({
    ...mapMovementRow(row),
    ingredientLabel: row.ingredient_label,
    ingredientShortLabel: row.ingredient_short_label,
  }))
}

async function countMovements({ ingredientKey } = {}, conn = null) {
  const clauses = []
  const vals = []
  if (ingredientKey) {
    clauses.push('ingredient_key = ?')
    vals.push(ingredientKey)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const [rows] = await q(conn).query(
    `SELECT COUNT(*) AS c FROM ingredient_inventory_movements ${where}`,
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
  listMovements,
  countMovements,
}
