const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapDonationRow(row) {
  return {
    id: row.id,
    fromCycleId: row.from_cycle_id,
    toCycleId: row.to_cycle_id,
    quantity: Number(row.quantity) || 0,
    donationDate: row.donation_date ?? '',
    notes: row.notes ?? '',
    fromSowId: row.from_sow_id ?? '',
    fromSowNumber: row.from_sow_number ?? '',
    toSowId: row.to_sow_id ?? '',
    toSowNumber: row.to_sow_number ?? '',
    createdAt: row.created_at,
  }
}

async function listDonationsForCycleIds(cycleIds, conn = null) {
  if (!cycleIds?.length) return []
  const placeholders = cycleIds.map(() => '?').join(', ')
  const [rows] = await q(conn).query(
    `SELECT
      d.id,
      d.from_cycle_id,
      d.to_cycle_id,
      d.quantity,
      d.donation_date,
      d.notes,
      d.created_at,
      fs.id AS from_sow_id,
      fs.number AS from_sow_number,
      ts.id AS to_sow_id,
      ts.number AS to_sow_number
    FROM sow_piglet_donations d
    INNER JOIN sow_productive_cycles fc ON fc.id = d.from_cycle_id
    INNER JOIN sows fs ON fs.id = fc.sow_id
    INNER JOIN sow_productive_cycles tc ON tc.id = d.to_cycle_id
    INNER JOIN sows ts ON ts.id = tc.sow_id
    WHERE d.from_cycle_id IN (${placeholders}) OR d.to_cycle_id IN (${placeholders})
    ORDER BY d.created_at ASC`,
    [...cycleIds, ...cycleIds],
  )
  return rows.map(mapDonationRow)
}

async function insertDonation(conn, row) {
  await q(conn).query(
    `INSERT INTO sow_piglet_donations (
      id, from_cycle_id, to_cycle_id, quantity, donation_date, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.fromCycleId,
      row.toCycleId,
      row.quantity,
      row.donationDate || null,
      row.notes || null,
      row.createdBy || null,
    ],
  )
}

async function findDonationById(donationId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT
      d.id,
      d.from_cycle_id,
      d.to_cycle_id,
      d.quantity,
      d.donation_date,
      d.notes,
      d.created_at,
      fs.id AS from_sow_id,
      fs.number AS from_sow_number,
      ts.id AS to_sow_id,
      ts.number AS to_sow_number
    FROM sow_piglet_donations d
    INNER JOIN sow_productive_cycles fc ON fc.id = d.from_cycle_id
    INNER JOIN sows fs ON fs.id = fc.sow_id
    INNER JOIN sow_productive_cycles tc ON tc.id = d.to_cycle_id
    INNER JOIN sows ts ON ts.id = tc.sow_id
    WHERE d.id = ?
    LIMIT 1`,
    [donationId],
  )
  return rows[0] ? mapDonationRow(rows[0]) : null
}

async function deleteDonationById(donationId, conn = null) {
  const [result] = await q(conn).query(
    `DELETE FROM sow_piglet_donations WHERE id = ?`,
    [donationId],
  )
  return result.affectedRows > 0
}

async function sumDonatedOut(cycleId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM sow_piglet_donations WHERE from_cycle_id = ?`,
    [cycleId],
  )
  return Number(rows[0]?.total) || 0
}

async function sumDonatedIn(cycleId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM sow_piglet_donations WHERE to_cycle_id = ?`,
    [cycleId],
  )
  return Number(rows[0]?.total) || 0
}

async function listLactationCandidates({ excludeSowId, excludeCycleId } = {}, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT
      s.id AS sow_id,
      s.number AS sow_number,
      c.id AS cycle_id,
      c.frp,
      c.born_alive,
      c.dead_lactation,
      c.wean_date,
      c.wean_qty
    FROM sows s
    INNER JOIN sow_productive_cycles c ON c.id = (
      SELECT c2.id
      FROM sow_productive_cycles c2
      WHERE c2.sow_id = s.id
      ORDER BY c2.sort_order DESC, c2.id DESC
      LIMIT 1
    )
    WHERE c.frp IS NOT NULL AND TRIM(c.frp) <> ''
      AND c.born_alive IS NOT NULL AND TRIM(c.born_alive) <> ''
    ORDER BY s.number ASC`,
  )

  return rows
    .filter((r) => {
      if (excludeSowId && r.sow_id === excludeSowId) return false
      if (excludeCycleId && r.cycle_id === excludeCycleId) return false
      return true
    })
    .map((r) => ({
      sowId: r.sow_id,
      sowNumber: r.sow_number,
      cycleId: r.cycle_id,
      bornAlive: r.born_alive ?? '',
      deadLactation: r.dead_lactation ?? '',
      weanDate: r.wean_date ?? '',
      weanQty: r.wean_qty ?? '',
    }))
}

module.exports = {
  listDonationsForCycleIds,
  insertDonation,
  findDonationById,
  deleteDonationById,
  sumDonatedOut,
  sumDonatedIn,
  listLactationCandidates,
}
