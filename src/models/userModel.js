const { pool } = require('../config/db')

async function createUser({ username, passwordHash, role }) {
  const [result] = await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, ?)`,
    [username, passwordHash, role],
  )

  return result.insertId
}

async function findByUsername(username) {
  const [rows] = await pool.query(
    `SELECT id, username, password_hash AS passwordHash, role, refresh_token_hash AS refreshTokenHash
     FROM users WHERE username = ? LIMIT 1`,
    [username],
  )
  return rows[0] || null
}

async function findById(userId) {
  const [rows] = await pool.query(
    `SELECT id, username, role FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )
  return rows[0] || null
}

async function updateRefreshTokenHash(userId, refreshTokenHash) {
  await pool.query(`UPDATE users SET refresh_token_hash = ? WHERE id = ?`, [
    refreshTokenHash,
    userId,
  ])
}

async function listUsers({ search = '', limit = 20, offset = 0 }) {
  const term = `%${String(search).trim()}%`
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM users WHERE username LIKE ?`,
    [term],
  )
  const total = Number(countRows[0]?.total ?? 0)
  const [rows] = await pool.query(
    `SELECT id, username, role, created_at AS createdAt, updated_at AS updatedAt
     FROM users WHERE username LIKE ?
     ORDER BY username ASC
     LIMIT ? OFFSET ?`,
    [term, limit, offset],
  )
  return { users: rows, total }
}

async function countAdmins() {
  const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`)
  return Number(rows[0]?.c ?? 0)
}

async function findUsernameConflict(username, excludeId = null) {
  const [rows] = await pool.query(
    excludeId != null
      ? `SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1`
      : `SELECT id FROM users WHERE username = ? LIMIT 1`,
    excludeId != null ? [username, excludeId] : [username],
  )
  return rows[0] || null
}

async function updateUserRecord(userId, { username, role, passwordHash }) {
  if (passwordHash) {
    await pool.query(
      `UPDATE users SET username = ?, role = ?, password_hash = ?, refresh_token_hash = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [username, role, passwordHash, userId],
    )
  } else {
    await pool.query(
      `UPDATE users SET username = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [username, role, userId],
    )
  }
}

async function deleteUserById(userId) {
  const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [userId])
  return result.affectedRows > 0
}

module.exports = {
  createUser,
  findByUsername,
  findById,
  updateRefreshTokenHash,
  listUsers,
  countAdmins,
  findUsernameConflict,
  updateUserRecord,
  deleteUserById,
}
