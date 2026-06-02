const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    cycleId: row.cycle_id,
    vaccineKey: row.vaccine_key,
    category: row.category,
    sortOrder: Number(row.sort_order) || 0,
    label: row.label,
    doseText: row.dose_text ?? '',
    isOptional: Boolean(row.is_optional),
    anchor: row.anchor,
    dayOffset: Number(row.day_offset) || 0,
    windowEndOffset: row.window_end_offset != null ? Number(row.window_end_offset) : null,
    targetDate: row.target_date ?? '',
    windowEndDate: row.window_end_date ?? '',
    administeredDate: row.administered_date ?? '',
    batchNo: row.batch_no ?? '',
    skipped: Boolean(row.skipped),
    notes: row.notes ?? '',
  }
}

async function listCyclesForSow(conn, sowId) {
  const [rows] = await q(conn).query(
    `SELECT id, fs, frp, wean_date AS weanDate, sort_order
     FROM sow_productive_cycles WHERE sow_id = ? ORDER BY sort_order ASC, id ASC`,
    [sowId],
  )
  return rows.map((r) => ({
    id: r.id,
    fs: r.fs,
    frp: r.frp,
    weanDate: r.weanDate ?? r.wean_date ?? '',
    sort_order: r.sort_order,
  }))
}

async function deleteAllVaccinationsForSow(conn, sowId) {
  await q(conn).query(
    `DELETE v FROM sow_cycle_vaccinations v
     INNER JOIN sow_productive_cycles c ON c.id = v.cycle_id
     WHERE c.sow_id = ?`,
    [sowId],
  )
}

/** Elimina filas que no corresponden al plan del último ciclo (otros ciclos o claves fuera del catálogo de la fase). */
async function deleteVaccinationsOutsidePlan(conn, sowId, lastCycleId, allowedKeys) {
  if (!allowedKeys.length) {
    await deleteAllVaccinationsForSow(conn, sowId)
    return
  }
  const placeholders = allowedKeys.map(() => '?').join(', ')
  await q(conn).query(
    `DELETE v FROM sow_cycle_vaccinations v
     INNER JOIN sow_productive_cycles c ON c.id = v.cycle_id
     WHERE c.sow_id = ?
       AND (v.cycle_id != ? OR v.vaccine_key NOT IN (${placeholders}))`,
    [sowId, lastCycleId, ...allowedKeys],
  )
}

async function upsertVaccinationRow(conn, params) {
  const {
    id,
    cycleId,
    vaccineKey,
    category,
    sortOrder,
    label,
    doseText,
    isOptional,
    anchor,
    dayOffset,
    windowEndOffset,
    targetDate,
    windowEndDate,
  } = params

  await q(conn).query(
    `INSERT INTO sow_cycle_vaccinations (
      id, cycle_id, vaccine_key, category, sort_order, label, dose_text, is_optional,
      anchor, day_offset, window_end_offset, target_date, window_end_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      category = VALUES(category),
      sort_order = VALUES(sort_order),
      label = VALUES(label),
      dose_text = VALUES(dose_text),
      is_optional = VALUES(is_optional),
      anchor = VALUES(anchor),
      day_offset = VALUES(day_offset),
      window_end_offset = VALUES(window_end_offset),
      target_date = VALUES(target_date),
      window_end_date = VALUES(window_end_date),
      updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      cycleId,
      vaccineKey,
      category,
      sortOrder,
      label,
      doseText || null,
      isOptional ? 1 : 0,
      anchor,
      dayOffset,
      windowEndOffset,
      targetDate || null,
      windowEndDate || null,
    ],
  )
}

async function findExistingId(conn, cycleId, vaccineKey) {
  const [rows] = await q(conn).query(
    `SELECT id FROM sow_cycle_vaccinations WHERE cycle_id = ? AND vaccine_key = ? LIMIT 1`,
    [cycleId, vaccineKey],
  )
  return rows[0]?.id || null
}

async function findById(vaccinationId) {
  const [rows] = await pool.query(`SELECT * FROM sow_cycle_vaccinations WHERE id = ? LIMIT 1`, [
    vaccinationId,
  ])
  return mapRow(rows[0])
}

async function updateApplication(conn, vaccinationId, fields) {
  const parts = []
  const vals = []
  if (fields.administeredDate !== undefined) {
    parts.push('administered_date = ?')
    vals.push(fields.administeredDate || null)
  }
  if (fields.batchNo !== undefined) {
    parts.push('batch_no = ?')
    vals.push(fields.batchNo || null)
  }
  if (fields.notes !== undefined) {
    parts.push('notes = ?')
    vals.push(fields.notes || null)
  }
  if (fields.skipped !== undefined) {
    parts.push('skipped = ?')
    vals.push(fields.skipped ? 1 : 0)
    if (fields.skipped) {
      parts.push('administered_date = NULL')
    }
  }
  if (parts.length === 0) return true
  vals.push(vaccinationId)
  const [r] = await q(conn).query(
    `UPDATE sow_cycle_vaccinations SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    vals,
  )
  return r.affectedRows > 0
}

async function listDashboardRows({ category, sowNumber, includeCompletedDays = 14 }) {
  const params = []
  let where = '1=1'

  if (category && String(category).trim()) {
    where += ' AND v.category = ?'
    params.push(String(category).trim())
  }
  if (sowNumber && String(sowNumber).trim()) {
    where += ' AND s.number LIKE ?'
    params.push(`%${String(sowNumber).trim()}%`)
  }

  const pendingClause =
    '(v.administered_date IS NULL OR v.administered_date = \'\') AND v.skipped = 0'

  const hasSowFilter = Boolean(sowNumber && String(sowNumber).trim())
  let completedClause = ''
  if (hasSowFilter) {
    // Cerda concreta: mostrar todo el historial aplicado/omitido del ciclo (inicio + módulo vacunas).
    completedClause = `
        OR (
          (v.administered_date IS NOT NULL AND TRIM(v.administered_date) <> '')
          OR v.skipped = 1
        )`
  } else if (includeCompletedDays > 0) {
    completedClause = `
        OR (
          v.administered_date IS NOT NULL AND v.administered_date != ''
          AND CHAR_LENGTH(v.administered_date) >= 10
          AND v.administered_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        )`
    params.push(includeCompletedDays)
  }

  const sql = `
    SELECT
      v.*,
      s.id AS sow_id,
      s.number AS sow_number,
      c.sort_order AS cycle_sort
    FROM sow_cycle_vaccinations v
    INNER JOIN sow_productive_cycles c ON c.id = v.cycle_id
    INNER JOIN sows s ON s.id = c.sow_id
    WHERE ${where}
      AND (
        ${pendingClause}
        ${completedClause}
      )
    ORDER BY
      CASE WHEN v.administered_date IS NULL OR v.administered_date = '' THEN 0 ELSE 1 END,
      v.target_date IS NULL,
      v.target_date ASC,
      s.number ASC,
      c.sort_order ASC,
      v.sort_order ASC
  `
  const [rows] = await pool.query(sql, params)
  return rows.map((row) => ({
    ...mapRow(row),
    sowId: row.sow_id,
    sowNumber: row.sow_number,
    cycleSort: Number(row.cycle_sort) || 0,
  }))
}

async function listSowIds() {
  const [rows] = await pool.query(`SELECT id FROM sows`)
  return rows.map((r) => r.id)
}

async function countGestationVaccinationsForCycle(cycleId, conn = null) {
  const [[row]] = await q(conn).query(
    `SELECT COUNT(*) AS c FROM sow_cycle_vaccinations WHERE cycle_id = ? AND category = 'gestacion'`,
    [cycleId],
  )
  return Number(row?.c) || 0
}

async function listIncompleteRequiredGestationForCycle(cycleId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT vaccine_key AS vaccineKey, label FROM sow_cycle_vaccinations
     WHERE cycle_id = ?
     AND category = 'gestacion'
     AND is_optional = 0
     AND (skipped = 0 OR skipped IS NULL)
     AND (administered_date IS NULL OR administered_date = '')
     ORDER BY sort_order ASC`,
    [cycleId],
  )
  return rows
}

async function countMaternityVaccinationsForCycle(cycleId, conn = null) {
  const [[row]] = await q(conn).query(
    `SELECT COUNT(*) AS c FROM sow_cycle_vaccinations
     WHERE cycle_id = ? AND category IN ('maternidad_hembra', 'maternidad_lechon')`,
    [cycleId],
  )
  return Number(row?.c) || 0
}

/**
 * Copia de seguridad de aplicaciones antes de borrar ciclos (ON DELETE CASCADE).
 * Clave: cycle_id + vaccine_key (los ids de ciclo se conservan en el frontend).
 */
async function listApplicationSnapshotsForSow(conn, sowId) {
  const [rows] = await q(conn).query(
    `SELECT v.cycle_id AS cycleId, v.vaccine_key AS vaccineKey,
            v.administered_date AS administeredDate, v.batch_no AS batchNo,
            v.skipped, v.notes
     FROM sow_cycle_vaccinations v
     INNER JOIN sow_productive_cycles c ON c.id = v.cycle_id
     WHERE c.sow_id = ?
       AND (
         (v.administered_date IS NOT NULL AND TRIM(v.administered_date) <> '')
         OR v.skipped = 1
       )`,
    [sowId],
  )
  return rows.map((r) => ({
    cycleId: r.cycleId,
    vaccineKey: r.vaccineKey,
    administeredDate: r.administeredDate ?? '',
    batchNo: r.batchNo ?? '',
    skipped: Boolean(r.skipped),
    notes: r.notes ?? '',
  }))
}

/** Restaura fechas de aplicación tras syncSowCycles (filas recreadas sin CASCADE). */
async function restoreApplicationSnapshots(conn, snapshots) {
  if (!snapshots?.length) return
  for (const s of snapshots) {
    await q(conn).query(
      `UPDATE sow_cycle_vaccinations SET
        administered_date = ?,
        batch_no = ?,
        skipped = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE cycle_id = ? AND vaccine_key = ?`,
      [
        s.skipped ? null : s.administeredDate || null,
        s.batchNo || null,
        s.skipped ? 1 : 0,
        s.notes || null,
        s.cycleId,
        s.vaccineKey,
      ],
    )
  }
}

async function listIncompleteRequiredMaternityForCycle(cycleId, conn = null) {
  const [rows] = await q(conn).query(
    `SELECT vaccine_key AS vaccineKey, label FROM sow_cycle_vaccinations
     WHERE cycle_id = ?
     AND category IN ('maternidad_hembra', 'maternidad_lechon')
     AND is_optional = 0
     AND (skipped = 0 OR skipped IS NULL)
     AND (administered_date IS NULL OR administered_date = '')
     ORDER BY sort_order ASC`,
    [cycleId],
  )
  return rows
}

module.exports = {
  listCyclesForSow,
  deleteAllVaccinationsForSow,
  deleteVaccinationsOutsidePlan,
  findExistingId,
  upsertVaccinationRow,
  findById,
  updateApplication,
  listDashboardRows,
  listSowIds,
  countGestationVaccinationsForCycle,
  listIncompleteRequiredGestationForCycle,
  countMaternityVaccinationsForCycle,
  listIncompleteRequiredMaternityForCycle,
  listApplicationSnapshotsForSow,
  restoreApplicationSnapshots,
}
