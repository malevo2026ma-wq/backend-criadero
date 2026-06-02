const { pool } = require('../config/db')

function mapRodeoRow(row) {
  return {
    id: row.id,
    number: row.number,
    breed: row.breed ?? '',
    serviceDate: row.service_date ?? '',
    cycleCount: Number(row.cycle_count) || 0,
    lastFs: row.last_fs ?? '',
    lastMaleNo: row.last_male_no ?? '',
    lastFpp: row.last_fpp ?? '',
    lastFrp: row.last_frp ?? '',
    lastBornAlive: row.last_born_alive ?? '',
    lastBornDead: row.last_born_dead ?? '',
    lastBornFetuses: row.last_born_fetuses ?? '',
    lastBornTotal: row.last_born_total ?? '',
    lastWeanDate: row.last_wean_date ?? '',
    lastWeanQty: row.last_wean_qty ?? '',
    lastWeanAvgWeight: row.last_wean_avg_weight ?? '',
    lastRepeatEstrus: Boolean(row.last_repeat_estrus),
    lastObservations: row.last_observations ?? '',
  }
}

async function listSowsRodeoRows() {
  const [rows] = await pool.query(
    `SELECT
      s.id,
      s.number,
      s.breed,
      s.service_date,
      (SELECT COUNT(*) FROM sow_productive_cycles c WHERE c.sow_id = s.id) AS cycle_count,
      lc.fs AS last_fs,
      lc.male_no AS last_male_no,
      lc.fpp AS last_fpp,
      lc.frp AS last_frp,
      lc.born_alive AS last_born_alive,
      lc.born_dead AS last_born_dead,
      lc.born_fetuses AS last_born_fetuses,
      lc.born_total AS last_born_total,
      lc.wean_date AS last_wean_date,
      lc.wean_qty AS last_wean_qty,
      lc.wean_avg_weight AS last_wean_avg_weight,
      lc.repeat_estrus AS last_repeat_estrus,
      lc.observations AS last_observations
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
  return rows.map(mapRodeoRow)
}

async function getHerdMetrics() {
  const [weanRows] = await pool.query(
    `SELECT
      COUNT(*) AS completed_cycles,
      COUNT(DISTINCT sow_id) AS weaning_sows,
      AVG(CAST(NULLIF(TRIM(wean_qty), '') AS DECIMAL(10,2))) AS avg_wean_qty_per_litter,
      SUM(CAST(NULLIF(TRIM(wean_qty), '') AS DECIMAL(10,2))) AS total_weaned,
      SUM(CASE WHEN repeat_estrus = 1 THEN 1 ELSE 0 END) AS repeat_count
     FROM sow_productive_cycles
     WHERE wean_date IS NOT NULL
       AND TRIM(wean_date) <> ''
       AND wean_qty IS NOT NULL
       AND TRIM(wean_qty) <> ''`,
  )

  const [sowWeanRows] = await pool.query(
    `SELECT AVG(sow_avg) AS avg_wean_qty_per_sow, COUNT(*) AS sow_count
     FROM (
       SELECT sow_id, AVG(CAST(NULLIF(TRIM(wean_qty), '') AS DECIMAL(10,2))) AS sow_avg
       FROM sow_productive_cycles
       WHERE wean_date IS NOT NULL AND TRIM(wean_date) <> ''
         AND wean_qty IS NOT NULL AND TRIM(wean_qty) <> ''
       GROUP BY sow_id
     ) per_sow`,
  )

  const [birthRows] = await pool.query(
    `SELECT
      COUNT(*) AS farrowing_cycles,
      COUNT(DISTINCT sow_id) AS farrowing_sows,
      AVG(CAST(NULLIF(TRIM(born_alive), '') AS DECIMAL(10,2))) AS avg_born_alive_per_litter
     FROM sow_productive_cycles
     WHERE frp IS NOT NULL AND TRIM(frp) <> ''
       AND born_alive IS NOT NULL AND TRIM(born_alive) <> ''`,
  )

  const [sowBirthRows] = await pool.query(
    `SELECT AVG(sow_avg) AS avg_born_alive_per_sow, COUNT(*) AS sow_count
     FROM (
       SELECT sow_id, AVG(CAST(NULLIF(TRIM(born_alive), '') AS DECIMAL(10,2))) AS sow_avg
       FROM sow_productive_cycles
       WHERE frp IS NOT NULL AND TRIM(frp) <> ''
         AND born_alive IS NOT NULL AND TRIM(born_alive) <> ''
       GROUP BY sow_id
     ) per_sow`,
  )

  const [mlRows] = await pool.query(
    `SELECT
      AVG(
        CASE
          WHEN frp IS NOT NULL AND TRIM(frp) <> ''
          THEN CAST(COALESCE(NULLIF(TRIM(dead_lactation), ''), '0') AS DECIMAL(10,2))
        END
      ) AS avg_dead_lactation_per_litter,
      SUM(
        CASE
          WHEN frp IS NOT NULL AND TRIM(frp) <> ''
            AND dead_lactation IS NOT NULL AND TRIM(dead_lactation) <> ''
          THEN CAST(NULLIF(TRIM(dead_lactation), '') AS DECIMAL(10,2))
          ELSE 0
        END
      ) AS total_dead_lactation,
      COUNT(
        CASE
          WHEN frp IS NOT NULL AND TRIM(frp) <> ''
            AND dead_lactation IS NOT NULL AND TRIM(dead_lactation) <> ''
            AND CAST(NULLIF(TRIM(dead_lactation), '') AS DECIMAL(10,2)) > 0
          THEN 1
        END
      ) AS cycles_with_dead_lactation
     FROM sow_productive_cycles`,
  )

  const [sowMlRows] = await pool.query(
    `SELECT AVG(sow_avg) AS avg_dead_lactation_per_sow, COUNT(*) AS sow_count
     FROM (
       SELECT
         sow_id,
         AVG(CAST(COALESCE(NULLIF(TRIM(dead_lactation), ''), '0') AS DECIMAL(10,2))) AS sow_avg
       FROM sow_productive_cycles
       WHERE frp IS NOT NULL AND TRIM(frp) <> ''
       GROUP BY sow_id
     ) per_sow
     WHERE sow_avg > 0`,
  )

  const [idcRows] = await pool.query(
    `SELECT AVG(CAST(NULLIF(TRIM(idc), '') AS DECIMAL(10,2))) AS avg_idc
     FROM sow_productive_cycles
     WHERE idc IS NOT NULL AND TRIM(idc) <> ''`,
  )

  const w = weanRows[0] || {}
  const sw = sowWeanRows[0] || {}
  const b = birthRows[0] || {}
  const sb = sowBirthRows[0] || {}
  const ml = mlRows[0] || {}
  const sml = sowMlRows[0] || {}
  const i = idcRows[0] || {}
  const completed = Number(w.completed_cycles) || 0
  const repeatCount = Number(w.repeat_count) || 0

  const num = (v) => (v != null && !Number.isNaN(Number(v)) ? Number(v) : null)

  return {
    completedCycles: completed,
    farrowingCycles: Number(b.farrowing_cycles) || 0,
    farrowingSows: Number(b.farrowing_sows) || 0,
    weaningSows: Number(w.weaning_sows) || 0,

    /** Promedio nacidos vivos por parto (camada). */
    avgBornAlivePerLitter: num(b.avg_born_alive_per_litter),
    /** Promedio nacidos vivos por madre (media de cada cerda). */
    avgBornAlivePerSow: num(sb.avg_born_alive_per_sow),
    bornAliveSowCount: Number(sb.sow_count) || 0,

    /** Promedio destetados por destete (camada). */
    avgWeanQtyPerLitter: num(w.avg_wean_qty_per_litter),
    /** Promedio destetados por madre. */
    avgWeanQtyPerSow: num(sw.avg_wean_qty_per_sow),
    weanSowCount: Number(sw.sow_count) || 0,
    totalWeaned: num(w.total_weaned) ?? 0,

    /** Muertos en lactancia (M/L). */
    avgDeadLactationPerLitter: num(ml.avg_dead_lactation_per_litter),
    avgDeadLactationPerSow: num(sml.avg_dead_lactation_per_sow),
    totalDeadLactation: num(ml.total_dead_lactation) ?? 0,
    cyclesWithDeadLactation: Number(ml.cycles_with_dead_lactation) || 0,
    sowsWithDeadLactation: Number(sml.sow_count) || 0,

    repeatEstrusPct: completed > 0 ? Math.round((repeatCount / completed) * 1000) / 10 : null,
    avgIdc: num(i.avg_idc),

    // Compatibilidad con nombres anteriores
    avgWeanQty: num(w.avg_wean_qty_per_litter),
    avgBornAlive: num(b.avg_born_alive_per_litter),
  }
}

/** Partos por mes (últimos 12 meses) para mini gráfico. */
async function getFarrowingsByMonth() {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(STR_TO_DATE(frp, '%Y-%m-%d'), '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM sow_productive_cycles
     WHERE frp IS NOT NULL AND TRIM(frp) <> ''
       AND STR_TO_DATE(frp, '%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY ym
     ORDER BY ym ASC`,
  )
  return rows.map((r) => ({ month: r.ym, count: Number(r.cnt) || 0 }))
}

module.exports = {
  listSowsRodeoRows,
  getHerdMetrics,
  getFarrowingsByMonth,
}
