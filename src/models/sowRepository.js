const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapCycleFromDb(row) {
  return {
    id: row.id,
    fDtt: row.f_dtt ?? '',
    idc: row.idc ?? '',
    fs: row.fs ?? '',
    maleNo: row.male_no ?? '',
    fpp: row.fpp ?? '',
    frp: row.frp ?? '',
    bornAlive: row.born_alive ?? '',
    bornDead: row.born_dead ?? '',
    bornFetuses: row.born_fetuses ?? '',
    bornTotal: row.born_total ?? '',
    deadLactation: row.dead_lactation ?? '',
    weanDate: row.wean_date ?? '',
    weanQty: row.wean_qty ?? '',
    weanAvgWeight: row.wean_avg_weight ?? '',
    weanDaysLactation: row.wean_days_lactation ?? '',
    observations: row.observations ?? '',
    repeatEstrus: Boolean(row.repeat_estrus),
  }
}

function mapSowSummaryRow(row) {
  return {
    id: row.id,
    number: row.number,
    entryDate: row.entry_date ?? '',
    birthDate: row.birth_date ?? '',
    breed: row.breed ?? '',
    cycleCount: Number(row.cycle_count) || 0,
  }
}

function mapSowDashboardRow(row) {
  return {
    id: row.id,
    number: row.number,
    serviceDate: row.service_date ?? '',
    lastFs: row.last_fs ?? '',
    lastFrp: row.last_frp ?? '',
    lastWeanDate: row.last_wean_date ?? '',
    lastFpp: row.last_fpp ?? '',
  }
}

/** Una fila por cerda con el último ciclo productivo (sort_order desc). */
async function listSowsDashboardRows() {
  const [rows] = await pool.query(
    `SELECT
      s.id,
      s.number,
      s.service_date,
      lc.fs AS last_fs,
      lc.frp AS last_frp,
      lc.wean_date AS last_wean_date,
      lc.fpp AS last_fpp
    FROM sows s
    LEFT JOIN sow_productive_cycles lc ON lc.id = (
      SELECT c.id
      FROM sow_productive_cycles c
      WHERE c.sow_id = s.id
      ORDER BY c.sort_order DESC, c.id DESC
      LIMIT 1
    )
    ORDER BY s.number ASC`,
  )
  return rows.map(mapSowDashboardRow)
}

async function listSowsSummary({ number: numberFilter } = {}) {
  let sql = `
    SELECT
      s.id,
      s.number,
      s.entry_date,
      s.birth_date,
      s.breed,
      (SELECT COUNT(*) FROM sow_productive_cycles c WHERE c.sow_id = s.id) AS cycle_count
    FROM sows s
  `
  const params = []
  if (numberFilter && String(numberFilter).trim()) {
    sql += ' WHERE s.number LIKE ?'
    params.push(`%${String(numberFilter).trim()}%`)
  }
  sql += ' ORDER BY s.number ASC'
  const [rows] = await pool.query(sql, params)
  return rows.map(mapSowSummaryRow)
}

async function findSowById(sowId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT id, number, entry_date, birth_date, service_date, breed
     FROM sows WHERE id = ? LIMIT 1`,
    [sowId],
  )
  return rows[0] || null
}

async function findSowByNumberExcluding(number, excludeId) {
  const [rows] = await pool.query(
    `SELECT id FROM sows WHERE number = ? AND id <> ? LIMIT 1`,
    [number, excludeId],
  )
  return rows[0] || null
}

async function findSowByNumber(number) {
  const [rows] = await pool.query(
    `SELECT id FROM sows WHERE number = ? LIMIT 1`,
    [number],
  )
  return rows[0] || null
}

async function listCyclesBySowId(sowId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT *
     FROM sow_productive_cycles
     WHERE sow_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [sowId],
  )
  return rows.map(mapCycleFromDb)
}

function mapSowHeaderToApi(row) {
  return {
    id: row.id,
    number: row.number,
    entryDate: row.entry_date ?? '',
    birthDate: row.birth_date ?? '',
    serviceDate: row.service_date ?? '',
    breed: row.breed ?? '',
  }
}

async function getSowWithCycles(sowId, conn = null) {
  const sow = await findSowById(sowId, conn)
  if (!sow) return null
  const cycles = await listCyclesBySowId(sowId, conn)
  return {
    ...mapSowHeaderToApi(sow),
    cycles,
  }
}

function cycleToDbParams(cycle, sowId, sortOrder) {
  return [
    cycle.id,
    sowId,
    sortOrder,
    cycle.fDtt || null,
    cycle.idc || null,
    cycle.fs || null,
    cycle.maleNo || null,
    cycle.fpp || null,
    cycle.frp || null,
    cycle.bornAlive || null,
    cycle.bornDead || null,
    cycle.bornFetuses || null,
    cycle.bornTotal || null,
    cycle.deadLactation || null,
    cycle.weanDate || null,
    cycle.weanQty || null,
    cycle.weanAvgWeight || null,
    cycle.weanDaysLactation || null,
    cycle.observations || null,
    cycle.repeatEstrus ? 1 : 0,
  ]
}

async function insertSow(connection, sowId, header) {
  await connection.query(
    `INSERT INTO sows (id, number, entry_date, birth_date, service_date, breed)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sowId,
      header.number,
      header.entryDate || null,
      header.birthDate || null,
      header.serviceDate || null,
      header.breed || null,
    ],
  )
}

const CYCLE_COLUMNS_SQL = `
  id, sow_id, sort_order, f_dtt, idc, fs, male_no, fpp, frp,
  born_alive, born_dead, born_fetuses, born_total, dead_lactation,
  wean_date, wean_qty, wean_avg_weight, wean_days_lactation,
  observations, repeat_estrus
`

const CYCLE_UPSERT_SQL = `
  INSERT INTO sow_productive_cycles (${CYCLE_COLUMNS_SQL})
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    sow_id = VALUES(sow_id),
    sort_order = VALUES(sort_order),
    f_dtt = VALUES(f_dtt),
    idc = VALUES(idc),
    fs = VALUES(fs),
    male_no = VALUES(male_no),
    fpp = VALUES(fpp),
    frp = VALUES(frp),
    born_alive = VALUES(born_alive),
    born_dead = VALUES(born_dead),
    born_fetuses = VALUES(born_fetuses),
    born_total = VALUES(born_total),
    dead_lactation = VALUES(dead_lactation),
    wean_date = VALUES(wean_date),
    wean_qty = VALUES(wean_qty),
    wean_avg_weight = VALUES(wean_avg_weight),
    wean_days_lactation = VALUES(wean_days_lactation),
    observations = VALUES(observations),
    repeat_estrus = VALUES(repeat_estrus)
`

async function upsertCycle(connection, sowId, cycle, sortOrder) {
  await connection.query(CYCLE_UPSERT_SQL, cycleToDbParams(cycle, sowId, sortOrder))
}

async function insertCycles(connection, sowId, cycles) {
  for (let i = 0; i < cycles.length; i += 1) {
    await upsertCycle(connection, sowId, cycles[i], i)
  }
}

/** IDs de ciclos que existen en BD (cualquier cerda). */
async function findCycleOwners(conn, cycleIds) {
  if (!cycleIds?.length) return new Map()
  const placeholders = cycleIds.map(() => '?').join(', ')
  const [rows] = await q(conn).query(
    `SELECT id, sow_id AS sowId FROM sow_productive_cycles WHERE id IN (${placeholders})`,
    cycleIds,
  )
  return new Map(rows.map((r) => [r.id, r.sowId]))
}

/**
 * Actualiza/inserta ciclos por id; solo borra filas eliminadas de la planilla.
 * No dispara CASCADE masivo sobre vacunas del mismo ciclo.
 */
async function syncCyclesForSow(connection, sowId, cycles) {
  const list = cycles ?? []
  const keepIds = list.map((c) => c.id).filter(Boolean)

  if (keepIds.length === 0) {
    await deleteCyclesForSow(connection, sowId)
    return
  }

  const placeholders = keepIds.map(() => '?').join(', ')
  await connection.query(
    `DELETE FROM sow_productive_cycles WHERE sow_id = ? AND id NOT IN (${placeholders})`,
    [sowId, ...keepIds],
  )

  for (let i = 0; i < list.length; i += 1) {
    await upsertCycle(connection, sowId, list[i], i)
  }
}

async function updateSowHeader(connection, sowId, header) {
  await connection.query(
    `UPDATE sows SET
      number = ?,
      entry_date = ?,
      birth_date = ?,
      service_date = ?,
      breed = ?
     WHERE id = ?`,
    [
      header.number,
      header.entryDate || null,
      header.birthDate || null,
      header.serviceDate || null,
      header.breed || null,
      sowId,
    ],
  )
}

async function deleteCyclesForSow(connection, sowId) {
  await connection.query(`DELETE FROM sow_productive_cycles WHERE sow_id = ?`, [
    sowId,
  ])
}

module.exports = {
  listSowsSummary,
  listSowsDashboardRows,
  getSowWithCycles,
  findSowById,
  findSowByNumber,
  findSowByNumberExcluding,
  insertSow,
  insertCycles,
  upsertCycle,
  syncCyclesForSow,
  findCycleOwners,
  listCyclesBySowId,
  updateSowHeader,
  deleteCyclesForSow,
}
