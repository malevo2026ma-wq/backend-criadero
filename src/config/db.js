const dns = require('dns')
const mysql = require('mysql2/promise')
const { env } = require('./env')

/** Railway *.railway.internal suele resolver solo IPv6; Node por defecto busca IPv4 → ENOTFOUND */
function railwayInternalLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...(options || {}), family: 0, all: true }, (err, addresses) => {
    if (err) {
      callback(err)
      return
    }
    if (Array.isArray(addresses) && addresses.length > 0) {
      const first = addresses.find((a) => a.family === 6) || addresses[0]
      callback(null, first.address, first.family)
      return
    }
    callback(err || new Error(`No se pudo resolver ${hostname}`))
  })
}

const poolConfig = {
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: env.isProduction ? 15 : 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
}

if (String(env.db.host).endsWith('.railway.internal')) {
  poolConfig.lookup = railwayInternalLookup
}

if (env.db.sslEnabled) {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  }
}

const pool = mysql.createPool(poolConfig)

async function pingDatabase() {
  const connection = await pool.getConnection()
  try {
    await connection.query('SELECT 1')
  } finally {
    connection.release()
  }
}

module.exports = { pool, pingDatabase }
