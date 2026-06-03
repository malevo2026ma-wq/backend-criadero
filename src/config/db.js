const dns = require('dns')
const mysql = require('mysql2/promise')
const {
  buildMysqlProfiles,
  isInternalRailwayHost,
} = require('./mysqlProfiles')

let pool = null
let activeProfileId = null

function railwayInternalLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...(options || {}), family: 0, all: true }, (err, addresses) => {
    if (err) {
      callback(err)
      return
    }
    if (Array.isArray(addresses) && addresses.length > 0) {
      const preferred =
        addresses.find((a) => a.family === 6) ||
        addresses.find((a) => a.family === 4) ||
        addresses[0]
      callback(null, preferred.address, preferred.family)
      return
    }
    callback(err || new Error(`No se pudo resolver ${hostname}`))
  })
}

function buildPoolConfig(profile) {
  const config = {
    host: profile.host,
    port: profile.port,
    user: profile.user,
    password: profile.password,
    database: profile.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: process.env.NODE_ENV === 'production' ? 15 : 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 20000,
  }

  if (isInternalRailwayHost(profile.host)) {
    config.lookup = railwayInternalLookup
  }

  if (profile.sslEnabled) {
    const strict = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
    config.ssl = { rejectUnauthorized: strict }
  }

  return config
}

async function tryConnectProfile(profile) {
  const testPool = mysql.createPool(buildPoolConfig(profile))
  try {
    const connection = await testPool.getConnection()
    try {
      await connection.query('SELECT 1')
    } finally {
      connection.release()
    }
    return testPool
  } catch (error) {
    await testPool.end().catch(() => {})
    throw error
  }
}

async function initDatabase() {
  if (pool) return pool

  const profiles = buildMysqlProfiles()
  if (profiles.length === 0) {
    throw new Error(
      'Sin perfiles MySQL. En Railway: backend → Variables → Add Variable Reference → MySQL (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQL_PUBLIC_URL).',
    )
  }

  const errors = []
  for (const profile of profiles) {
    try {
      pool = await tryConnectProfile(profile)
      activeProfileId = profile.id
      return pool
    } catch (error) {
      errors.push({
        id: profile.id,
        host: profile.host,
        port: profile.port,
        code: error?.code,
        message: error?.message,
      })
    }
  }

  const detail = errors
    .map((e) => `${e.id} (${e.host}:${e.port}): ${e.code || ''} ${e.message || ''}`)
    .join(' | ')
  throw new Error(`No se pudo conectar a MySQL. Intentos: ${detail}`)
}

async function pingDatabase() {
  if (!pool) {
    await initDatabase()
  }
  const connection = await pool.getConnection()
  try {
    await connection.query('SELECT 1')
  } finally {
    connection.release()
  }
}

function getActiveConnectionInfo() {
  return { profileId: activeProfileId, ready: Boolean(pool) }
}

module.exports = {
  initDatabase,
  pingDatabase,
  get pool() {
    return pool
  },
  getActiveConnectionInfo,
}
