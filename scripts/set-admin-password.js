#!/usr/bin/env node
/**
 * Cambia la contraseña del usuario admin en producción.
 * Uso: node scripts/set-admin-password.js "NuevaContraseñaSegura"
 */
const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')

async function main() {
  const password = process.argv[2]
  if (!password || password.length < 8) {
    console.error('Uso: node scripts/set-admin-password.js "ContraseñaMin8Chars"')
    process.exit(1)
  }

  const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost'
  const port = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306)
  const user = process.env.DB_USER || process.env.MYSQLUSER || 'root'
  const dbPassword = process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? ''
  const database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway'

  const sslEnabled = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password: dbPassword,
    database,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: true } } : {}),
  })

  try {
    const hash = await bcrypt.hash(password, 12)
    const [result] = await conn.query(
      `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = 'admin'`,
      [hash],
    )
    if (result.affectedRows === 0) {
      console.error('No se encontró el usuario admin.')
      process.exit(1)
    }
    console.log('Contraseña de admin actualizada correctamente.')
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
