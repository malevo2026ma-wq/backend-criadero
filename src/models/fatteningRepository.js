const { randomUUID } = require('crypto')
const { pool } = require('../config/db')

function mapMonthRow(row) {
  if (!row) return null
  return {
    id: row.id,
    year: Number(row.year),
    month: Number(row.month),
    opening: {
      maternidad: Number(row.opening_maternidad) || 0,
      recria: Number(row.opening_recria) || 0,
      desarrollo: Number(row.opening_desarrollo) || 0,
      terminacion: Number(row.opening_terminacion) || 0,
    },
    notes: row.notes ?? '',
  }
}

function mapDailyRow(row) {
  return {
    id: row.id,
    monthId: row.month_id,
    dayOfMonth: Number(row.day_of_month),
    stage: row.stage,
    manualIngreso: Number(row.manual_ingreso) || 0,
    manualDeaths: Number(row.manual_deaths) || 0,
    manualSalida: Number(row.manual_salida) || 0,
    notes: row.notes ?? '',
  }
}

function mapMovementRow(row) {
  return {
    id: row.id,
    monthId: row.month_id,
    dayOfMonth: Number(row.day_of_month),
    stage: row.stage,
    movementType: row.movement_type,
    quantity: Number(row.quantity) || 0,
    counterStage: row.counter_stage,
    sowNumber: row.sow_number,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
  }
}

async function findMonthByYearMonth(year, month) {
  const [rows] = await pool.query(
    `SELECT * FROM fattening_months WHERE year = ? AND month = ? LIMIT 1`,
    [year, month],
  )
  return mapMonthRow(rows[0])
}

async function insertMonth(row) {
  await pool.query(
    `INSERT INTO fattening_months (
      id, year, month,
      opening_maternidad, opening_recria, opening_desarrollo, opening_terminacion, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.year,
      row.month,
      row.opening.maternidad,
      row.opening.recria,
      row.opening.desarrollo,
      row.opening.terminacion,
      row.notes || null,
    ],
  )
}

async function updateMonthOpening(monthId, opening, notes) {
  await pool.query(
    `UPDATE fattening_months SET
      opening_maternidad = ?,
      opening_recria = ?,
      opening_desarrollo = ?,
      opening_terminacion = ?,
      notes = ?
    WHERE id = ?`,
    [
      opening.maternidad,
      opening.recria,
      opening.desarrollo,
      opening.terminacion,
      notes ?? null,
      monthId,
    ],
  )
}

async function listDailyForMonth(monthId) {
  const [rows] = await pool.query(
    `SELECT * FROM fattening_daily WHERE month_id = ? ORDER BY day_of_month ASC, stage ASC`,
    [monthId],
  )
  return rows.map(mapDailyRow)
}

async function upsertDaily(monthId, day, stage, { manualIngreso, manualDeaths, manualSalida, notes }) {
  const [existing] = await pool.query(
    `SELECT id FROM fattening_daily
     WHERE month_id = ? AND day_of_month = ? AND stage = ? LIMIT 1`,
    [monthId, day, stage],
  )
  if (existing[0]) {
    await pool.query(
      `UPDATE fattening_daily SET
        manual_ingreso = ?,
        manual_deaths = ?,
        manual_salida = ?,
        notes = ?
      WHERE id = ?`,
      [manualIngreso, manualDeaths, manualSalida, notes ?? null, existing[0].id],
    )
    return existing[0].id
  }
  const id = randomUUID()
  await pool.query(
    `INSERT INTO fattening_daily (
      id, month_id, day_of_month, stage,
      manual_ingreso, manual_deaths, manual_salida, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, monthId, day, stage, manualIngreso, manualDeaths, manualSalida, notes ?? null],
  )
  return id
}

async function addManualDelta(monthId, day, stage, deltas) {
  const [rows] = await pool.query(
    `SELECT * FROM fattening_daily
     WHERE month_id = ? AND day_of_month = ? AND stage = ? LIMIT 1`,
    [monthId, day, stage],
  )
  const cur = rows[0]
  const ingreso = (Number(cur?.manual_ingreso) || 0) + (deltas.manualIngreso || 0)
  const deaths = (Number(cur?.manual_deaths) || 0) + (deltas.manualDeaths || 0)
  const salida = (Number(cur?.manual_salida) || 0) + (deltas.manualSalida || 0)
  return upsertDaily(monthId, day, stage, {
    manualIngreso: ingreso,
    manualDeaths: deaths,
    manualSalida: salida,
    notes: cur?.notes ?? deltas.notes ?? null,
  })
}

async function insertMovement(row) {
  const id = row.id || randomUUID()
  await pool.query(
    `INSERT INTO fattening_movements (
      id, month_id, day_of_month, stage, movement_type, quantity,
      counter_stage, sow_number, notes, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      row.monthId,
      row.dayOfMonth,
      row.stage,
      row.movementType,
      row.quantity,
      row.counterStage ?? null,
      row.sowNumber ?? null,
      row.notes ?? null,
      row.source || 'manual',
    ],
  )
  return id
}

async function listMovementsForMonth(monthId, { day, stage } = {}) {
  let sql = `SELECT * FROM fattening_movements WHERE month_id = ?`
  const params = [monthId]
  if (day) {
    sql += ` AND day_of_month = ?`
    params.push(day)
  }
  if (stage) {
    sql += ` AND stage = ?`
    params.push(stage)
  }
  sql += ` ORDER BY day_of_month ASC, created_at ASC`
  const [rows] = await pool.query(sql, params)
  return rows.map(mapMovementRow)
}

module.exports = {
  findMonthByYearMonth,
  insertMonth,
  updateMonthOpening,
  listDailyForMonth,
  upsertDaily,
  addManualDelta,
  insertMovement,
  listMovementsForMonth,
}
