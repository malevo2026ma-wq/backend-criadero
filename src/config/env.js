const dotenv = require('dotenv')

dotenv.config()

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'access_secret'
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh_secret'

const WEAK_SECRETS = new Set([
  'access_secret',
  'refresh_secret',
  'change_this_access_secret',
  'change_this_refresh_secret',
])

function normalizeOrigin(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '')
}

function parseFrontendOrigins() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173'
  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)
}

function parseMysqlUrl(raw) {
  const url = String(raw ?? '').trim()
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'mysql:' && u.protocol !== 'mysql2:') return null
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username || 'root'),
      password: decodeURIComponent(u.password || ''),
      database: decodeURIComponent(u.pathname.replace(/^\//, '') || 'railway'),
      sslEnabled:
        u.searchParams.get('ssl') === 'true' ||
        u.hostname.includes('rlwy.net') ||
        u.hostname.includes('proxy.rlwy.net'),
    }
  } catch {
    return null
  }
}

function resolveDbConfig() {
  const fromUrl =
    parseMysqlUrl(process.env.MYSQL_URL) ||
    parseMysqlUrl(process.env.MYSQL_PUBLIC_URL) ||
    parseMysqlUrl(process.env.DATABASE_URL)

  if (fromUrl) {
    const sslOverride = process.env.DB_SSL
    return {
      ...fromUrl,
      sslEnabled:
        sslOverride === 'true' || sslOverride === '1'
          ? true
          : sslOverride === 'false' || sslOverride === '0'
            ? false
            : fromUrl.sslEnabled,
    }
  }

  const host =
    process.env.DB_HOST ||
    process.env.MYSQLHOST ||
    process.env.MYSQL_HOST ||
    'localhost'
  const port = Number(
    process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
  )
  const user =
    process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root'
  const password =
    process.env.DB_PASSWORD ??
    process.env.MYSQLPASSWORD ??
    process.env.MYSQL_PASSWORD ??
    ''
  const database =
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    'railway'

  const sslEnabled =
    process.env.DB_SSL === 'true' ||
    process.env.DB_SSL === '1' ||
    process.env.MYSQL_SSL === 'true'

  return { host, port, user, password, database, sslEnabled }
}

function hasDbCredentials(db) {
  if (db.password) return true
  const hasUrl = Boolean(
    process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL,
  )
  return hasUrl
}

function assertProductionConfig() {
  if (!isProduction) return

  if (WEAK_SECRETS.has(jwtAccessSecret) || WEAK_SECRETS.has(jwtRefreshSecret)) {
    throw new Error(
      'Configuración inválida: definí JWT_ACCESS_SECRET y JWT_REFRESH_SECRET seguros en producción.',
    )
  }

  const origins = parseFrontendOrigins()
  if (origins.length === 0) {
    throw new Error('Configuración inválida: FRONTEND_URL es obligatorio en producción.')
  }

  const db = resolveDbConfig()
  if (!hasDbCredentials(db)) {
    throw new Error(
      'Configuración inválida: faltan credenciales MySQL. En Railway → servicio backend → Variables → "Add Variable Reference" y vinculá el servicio MySQL (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE) o MYSQL_URL.',
    )
  }
}

assertProductionConfig()

const dbResolved = resolveDbConfig()
const frontendOrigins = parseFrontendOrigins()

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3000),
  frontendUrl: frontendOrigins[0] || 'http://localhost:5173',
  frontendOrigins,
  allowPublicRegister:
    process.env.ALLOW_PUBLIC_REGISTER === 'true' || process.env.ALLOW_PUBLIC_REGISTER === '1',
  vaccinationEnforceWindow:
    process.env.VACCINATION_ENFORCE_APPLICATION_WINDOW === 'true' ||
    process.env.VACCINATION_ENFORCE_APPLICATION_WINDOW === '1',
  db: {
    host: dbResolved.host,
    port: dbResolved.port,
    user: dbResolved.user,
    password: dbResolved.password,
    database: dbResolved.database,
    sslEnabled: dbResolved.sslEnabled,
  },
  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
}

module.exports = { env }
