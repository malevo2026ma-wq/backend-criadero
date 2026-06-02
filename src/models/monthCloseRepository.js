const { randomUUID } = require('crypto')
const { pool } = require('../config/db')

function mapRow(row) {
  if (!row) return null
  let manual = {}
  try {
    manual = typeof row.manual_data === 'string' ? JSON.parse(row.manual_data) : row.manual_data
  } catch {
    manual = {}
  }
  return {
    id: row.id,
    year: Number(row.year),
    month: Number(row.month),
    producer: row.producer ?? '',
    closeDate: row.close_date ?? '',
    manualData: manual,
    updatedAt: row.updated_at,
  }
}

async function findByYearMonth(year, month) {
  const [rows] = await pool.query(
    `SELECT * FROM month_closes WHERE year = ? AND month = ? LIMIT 1`,
    [year, month],
  )
  return mapRow(rows[0])
}

async function upsert({ year, month, producer, closeDate, manualData, userId }) {
  const existing = await findByYearMonth(year, month)
  const json = JSON.stringify(manualData ?? {})
  if (existing) {
    await pool.query(
      `UPDATE month_closes
       SET producer = ?, close_date = ?, manual_data = ?, updated_by = ?
       WHERE year = ? AND month = ?`,
      [producer ?? null, closeDate ?? null, json, userId ?? null, year, month],
    )
    return findByYearMonth(year, month)
  }
  const id = randomUUID()
  await pool.query(
    `INSERT INTO month_closes (id, year, month, producer, close_date, manual_data, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, year, month, producer ?? null, closeDate ?? null, json, userId ?? null],
  )
  return findByYearMonth(year, month)
}

async function listAllCyclesWithSows() {
  const [rows] = await pool.query(
    `SELECT
      s.id AS sow_id,
      s.birth_date,
      s.entry_date,
      c.id AS cycle_id,
      c.sort_order,
      c.fs,
      c.frp,
      c.wean_date,
      c.born_alive,
      c.born_dead,
      c.born_fetuses,
      c.born_total,
      c.dead_lactation,
      c.wean_qty,
      c.repeat_estrus
    FROM sows s
    LEFT JOIN sow_productive_cycles c ON c.sow_id = s.id
    ORDER BY s.id ASC, c.sort_order ASC`,
  )
  return rows
}

module.exports = {
  findByYearMonth,
  upsert,
  listAllCyclesWithSows,
}
