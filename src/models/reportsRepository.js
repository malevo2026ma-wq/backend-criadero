const { pool } = require('../config/db')

function mapBirthRow(row) {
  return {
    sowId: row.sow_id,
    sowNumber: row.sow_number,
    date: row.frp ?? '',
    bornAlive: row.born_alive ?? '',
    bornDead: row.born_dead ?? '',
    bornMummified: row.born_fetuses ?? '',
    bornTotal: row.born_total ?? '',
  }
}

function mapWeaningRow(row) {
  return {
    sowId: row.sow_id,
    sowNumber: row.sow_number,
    date: row.wean_date ?? '',
    piglets: row.wean_qty ?? '',
    daysOfLife: row.wean_days_lactation ?? '',
  }
}

async function listBirthCyclesRaw() {
  const [rows] = await pool.query(
    `SELECT
      s.id AS sow_id,
      s.number AS sow_number,
      c.frp,
      c.born_alive,
      c.born_dead,
      c.born_fetuses,
      c.born_total
    FROM sow_productive_cycles c
    INNER JOIN sows s ON s.id = c.sow_id
    WHERE c.frp IS NOT NULL AND TRIM(c.frp) <> ''
    ORDER BY c.frp ASC, s.number ASC`,
  )
  return rows.map(mapBirthRow)
}

async function listWeaningCyclesRaw() {
  const [rows] = await pool.query(
    `SELECT
      s.id AS sow_id,
      s.number AS sow_number,
      c.wean_date,
      c.wean_qty,
      c.wean_days_lactation
    FROM sow_productive_cycles c
    INNER JOIN sows s ON s.id = c.sow_id
    WHERE c.wean_date IS NOT NULL AND TRIM(c.wean_date) <> ''
    ORDER BY c.wean_date ASC, s.number ASC`,
  )
  return rows.map(mapWeaningRow)
}

module.exports = {
  listBirthCyclesRaw,
  listWeaningCyclesRaw,
}
