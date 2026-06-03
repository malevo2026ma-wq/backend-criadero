const LOG_PREFIX = '[Cabaña El Simbol · API]'

function logInfo(message) {
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${message}`)
}

function logError(message) {
  // eslint-disable-next-line no-console
  console.error(`${LOG_PREFIX} ${message}`)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function connectDatabase() {
  const { initDatabase, getActiveConnectionInfo } = require('./config/db')
  const { env } = require('./config/env')
  const { buildMysqlProfiles } = require('./config/mysqlProfiles')

  const profiles = buildMysqlProfiles()
  logInfo(
    `Perfiles MySQL a probar: ${profiles.map((p) => p.id).join(' → ') || '(ninguno)'}`,
  )
  logInfo(
    `Objetivo principal: ${env.db.host}:${env.db.port}, base "${env.db.database}"`,
  )

  let lastError
  const maxAttempts = 8
  const delayMs = 2500

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await initDatabase()
      const info = getActiveConnectionInfo()
      logInfo(`MySQL conectado (perfil: ${info.profileId}). Pool listo.`)
      return
    } catch (error) {
      lastError = error
      const retryable =
        error?.code === 'ENOTFOUND' ||
        error?.code === 'EAI_AGAIN' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ECONNREFUSED' ||
        String(error?.message || '').includes('Intentos:')

      if (!retryable || attempt === maxAttempts) {
        throw error
      }
      logInfo(
        `MySQL aún no disponible. Reintento global ${attempt}/${maxAttempts - 1} en ${delayMs / 1000}s…`,
      )
      await sleep(delayMs)
    }
  }

  throw lastError
}

async function start() {
  logInfo('Iniciando aplicación…')

  try {
    await connectDatabase()
  } catch (error) {
    logError('MySQL: no fue posible conectar.')
    if (error?.code) logError(`Código: ${error.code}`)
    logError(`Detalle: ${error?.message || 'Error desconocido.'}`)
    logError(
      'Railway: en el servicio backend usá Variable Reference desde MySQL (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQL_PUBLIC_URL). Mismo proyecto y entorno production.',
    )
    process.exit(1)
  }

  const { app } = require('./app')
  const { env } = require('./config/env')

  const server = app.listen(env.port, '0.0.0.0', () => {
    logInfo(`Servidor HTTP en escucha en el puerto ${env.port}`)
    logInfo(`Entorno: ${env.nodeEnv}`)
    logInfo('Arranque completado correctamente.')
  })

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logError(
        `El puerto ${env.port} ya está en uso. Cambie PORT en .env o libere el puerto.`,
      )
    } else {
      logError(`Error al iniciar el servidor HTTP: ${error.message}`)
    }
    process.exit(1)
  })
}

start().catch((error) => {
  logError(`Arranque abortado: ${error?.message || 'Error desconocido.'}`)
  process.exit(1)
})
