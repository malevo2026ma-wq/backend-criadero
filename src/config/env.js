const dotenv = require('dotenv')
const {
  buildMysqlProfiles,
  getPrimaryDbSummary,
  hasAnyMysqlSource,
} = require('./mysqlProfiles')

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

  if (!hasAnyMysqlSource()) {
    throw new Error(
      'Configuración inválida: faltan variables MySQL. Railway → backend → Variables → Add Variable Reference → servicio MySQL: MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE y MYSQL_PUBLIC_URL.',
    )
  }
}

assertProductionConfig()

const mysqlProfiles = buildMysqlProfiles()
const dbResolved = getPrimaryDbSummary(mysqlProfiles)
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
    connectionMode: dbResolved.connectionMode,
  },
  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
}

module.exports = { env }
