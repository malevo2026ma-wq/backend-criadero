const { app } = require('./app')
const { env } = require('./config/env')
const { pingDatabase } = require('./config/db')

const LOG_PREFIX = '[Cabaña El Simbol · API]'

function logInfo(message) {
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${message}`)
}

function logError(message) {
  // eslint-disable-next-line no-console
  console.error(`${LOG_PREFIX} ${message}`)
}

async function start() {
  logInfo('Iniciando aplicación…')

  try {
    logInfo(
      `Comprobando conexión a MySQL (${env.db.host}:${env.db.port}, base "${env.db.database}")…`,
    )
    await pingDatabase()
    logInfo('MySQL: conexión correcta. El pool está listo para consultas.')
  } catch (error) {
    logError('MySQL: no fue posible conectar o consultar la base de datos.')
    if (error?.code) {
      logError(`Código: ${error.code}`)
    }
    logError(`Detalle: ${error?.message || 'Error desconocido.'}`)
    logError(
      'Revise DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME en .env, y que los scripts de database/ estén ejecutados.',
    )
    process.exit(1)
  }

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
