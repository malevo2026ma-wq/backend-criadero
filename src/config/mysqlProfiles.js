/**
 * Perfiles de conexión MySQL para Railway y desarrollo local.
 * Orden: variables discretas (MYSQLHOST…) → MYSQL_URL interna → MYSQL_PUBLIC_URL.
 */

function parseMysqlUrl(raw) {
  const url = String(raw ?? '').trim()
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'mysql:' && u.protocol !== 'mysql2:') return null
    const host = u.hostname
    return {
      host,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username || 'root'),
      password: decodeURIComponent(u.password || ''),
      database: decodeURIComponent(u.pathname.replace(/^\//, '') || 'railway'),
      isPublic: isPublicMysqlHost(host),
    }
  } catch {
    return null
  }
}

function isPublicMysqlHost(host) {
  const h = String(host || '').toLowerCase()
  return h.includes('rlwy.net') || h.includes('proxy.rlwy.net')
}

function isInternalRailwayHost(host) {
  return String(host || '').endsWith('.railway.internal')
}

function readPassword() {
  const direct =
    process.env.MYSQLPASSWORD ??
    process.env.MYSQL_PASSWORD ??
    process.env.DB_PASSWORD
  if (direct != null && String(direct).length > 0) return String(direct)

  const fromUrl =
    parseMysqlUrl(process.env.MYSQL_URL) ||
    parseMysqlUrl(process.env.MYSQL_PUBLIC_URL) ||
    parseMysqlUrl(process.env.DATABASE_URL)
  return fromUrl?.password || ''
}

function applySslOverride(profile) {
  const override = process.env.DB_SSL
  if (override === 'true' || override === '1') return { ...profile, sslEnabled: true }
  if (override === 'false' || override === '0') return { ...profile, sslEnabled: false }
  return profile
}

function buildMysqlProfiles() {
  const password = readPassword()
  const profiles = []

  const host =
    process.env.MYSQLHOST ||
    process.env.MYSQL_HOST ||
    process.env.DB_HOST ||
    ''
  const port = Number(
    process.env.MYSQLPORT || process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
  )
  const user =
    process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.DB_USER || 'root'
  const database =
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    process.env.DB_NAME ||
    'railway'

  if (host && password) {
    const isPublic = isPublicMysqlHost(host)
    profiles.push({
      id: 'railway-vars',
      host,
      port,
      user,
      password,
      database,
      sslEnabled: isPublic,
      isPublic,
    })
  }

  const internalUrl = parseMysqlUrl(process.env.MYSQL_URL)
  if (internalUrl?.host && internalUrl.password) {
    profiles.push({
      id: 'mysql-url',
      ...internalUrl,
      sslEnabled: false,
      isPublic: false,
    })
  } else if (internalUrl?.host && password) {
    profiles.push({
      id: 'mysql-url',
      host: internalUrl.host,
      port: internalUrl.port,
      user: internalUrl.user,
      password,
      database: internalUrl.database,
      sslEnabled: false,
      isPublic: false,
    })
  }

  const publicUrl = parseMysqlUrl(process.env.MYSQL_PUBLIC_URL)
  if (publicUrl?.host && (publicUrl.password || password)) {
    profiles.push({
      id: 'mysql-public-url',
      host: publicUrl.host,
      port: publicUrl.port,
      user: publicUrl.user,
      password: publicUrl.password || password,
      database: publicUrl.database,
      sslEnabled: true,
      isPublic: true,
    })
  }

  const databaseUrl = parseMysqlUrl(process.env.DATABASE_URL)
  if (databaseUrl?.host && (databaseUrl.password || password)) {
    profiles.push({
      id: 'database-url',
      host: databaseUrl.host,
      port: databaseUrl.port,
      user: databaseUrl.user,
      password: databaseUrl.password || password,
      database: databaseUrl.database,
      sslEnabled: databaseUrl.isPublic,
      isPublic: databaseUrl.isPublic,
    })
  }

  const seen = new Set()
  const unique = []
  for (const p of profiles.map(applySslOverride)) {
    const key = `${p.host}:${p.port}:${p.user}:${p.database}:${p.sslEnabled}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(p)
  }

  return unique
}

function hasAnyMysqlSource() {
  if (readPassword()) return true
  return Boolean(
    process.env.MYSQL_URL ||
      process.env.MYSQL_PUBLIC_URL ||
      process.env.DATABASE_URL ||
      process.env.MYSQLHOST,
  )
}

function getPrimaryDbSummary(profiles) {
  const first = profiles[0]
  if (!first) {
    return {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'railway',
      sslEnabled: false,
      connectionMode: 'none',
    }
  }
  return {
    host: first.host,
    port: first.port,
    user: first.user,
    password: first.password,
    database: first.database,
    sslEnabled: first.sslEnabled,
    connectionMode: first.id,
  }
}

module.exports = {
  buildMysqlProfiles,
  getPrimaryDbSummary,
  hasAnyMysqlSource,
  isInternalRailwayHost,
  isPublicMysqlHost,
  parseMysqlUrl,
}
