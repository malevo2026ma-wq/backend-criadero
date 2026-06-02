const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapMonthRow(row) {
  if (!row) return null
  return {
    id: row.id,
    year: Number(row.year),
    month: Number(row.month),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEntryRow(row) {
  if (!row) return null
  return {
    id: row.id,
    monthId: row.month_id,
    dayOfMonth: Number(row.day_of_month),
    feedKey: row.feed_key,
    quantity: Number(row.quantity),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listMonths({ limit = 24 } = {}) {
  const [rows] = await pool.query(
    `SELECT * FROM feed_months ORDER BY year DESC, month DESC LIMIT ?`,
    [limit],
  )
  return rows.map(mapMonthRow)
}

async function findMonthByYearMonth(year, month, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT * FROM feed_months WHERE year = ? AND month = ? LIMIT 1`,
    [year, month],
  )
  return mapMonthRow(rows[0])
}

async function findMonthById(monthId, conn = null) {
  const [rows] = await q(conn).query(`SELECT * FROM feed_months WHERE id = ? LIMIT 1`, [monthId])
  return mapMonthRow(rows[0])
}

async function insertMonth(conn, row) {
  await q(conn).query(`INSERT INTO feed_months (id, year, month, notes) VALUES (?, ?, ?, ?)`, [
    row.id,
    row.year,
    row.month,
    row.notes || null,
  ])
}

async function updateMonthNotes(conn, monthId, notes) {
  await q(conn).query(`UPDATE feed_months SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    notes || null,
    monthId,
  ])
}

async function listOpeningBalances(monthId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT feed_key, quantity FROM feed_month_opening_balances WHERE month_id = ?`,
    [monthId],
  )
  const map = {}
  for (const r of rows) {
    map[r.feed_key] = Number(r.quantity)
  }
  return map
}

async function upsertOpeningBalance(conn, monthId, feedKey, quantity) {
  await q(conn).query(
    `INSERT INTO feed_month_opening_balances (month_id, feed_key, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
    [monthId, feedKey, quantity],
  )
}

async function listEntriesForMonth(monthId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT * FROM feed_consumption_entries WHERE month_id = ? ORDER BY day_of_month ASC, feed_key ASC, created_at ASC`,
    [monthId],
  )
  return rows.map(mapEntryRow)
}

async function findEntryById(entryId) {
  const [rows] = await pool.query(`SELECT * FROM feed_consumption_entries WHERE id = ? LIMIT 1`, [entryId])
  return mapEntryRow(rows[0])
}

async function insertEntry(conn, row) {
  await q(conn).query(
    `INSERT INTO feed_consumption_entries (id, month_id, day_of_month, feed_key, quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.monthId, row.dayOfMonth, row.feedKey, row.quantity, row.notes || null],
  )
}

async function updateEntry(entryId, fields, conn = null) {
  const parts = []
  const vals = []
  if (fields.quantity !== undefined) {
    parts.push('quantity = ?')
    vals.push(fields.quantity)
  }
  if (fields.notes !== undefined) {
    parts.push('notes = ?')
    vals.push(fields.notes || null)
  }
  if (fields.dayOfMonth !== undefined) {
    parts.push('day_of_month = ?')
    vals.push(fields.dayOfMonth)
  }
  if (fields.feedKey !== undefined) {
    parts.push('feed_key = ?')
    vals.push(fields.feedKey)
  }
  if (parts.length === 0) return false
  vals.push(entryId)
  const [r] = await q(conn).query(
    `UPDATE feed_consumption_entries SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    vals,
  )
  return r.affectedRows > 0
}

async function deleteEntry(entryId, conn = null) {
  const [r] = await q(conn).query(`DELETE FROM feed_consumption_entries WHERE id = ?`, [entryId])
  return r.affectedRows > 0
}

module.exports = {
  listMonths,
  findMonthByYearMonth,
  findMonthById,
  insertMonth,
  updateMonthNotes,
  listOpeningBalances,
  upsertOpeningBalance,
  listEntriesForMonth,
  findEntryById,
  insertEntry,
  updateEntry,
  deleteEntry,
}
