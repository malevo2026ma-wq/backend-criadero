const { env } = require('../config/env')

function notFoundHandler(_req, res) {
  return res.status(404).json({
    success: false,
    message: 'Ruta no encontrada.',
  })
}

function errorHandler(err, _req, res, _next) {
  if (err?.message === 'Origen no permitido por CORS.') {
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido.',
    })
  }

  const statusCode = err.statusCode || 500
  const isAppError = Boolean(err.statusCode) && err.statusCode < 500

  let message = err.message || 'Error interno del servidor.'
  if (env.isProduction && statusCode >= 500 && !isAppError) {
    message = 'Error interno del servidor.'
  }

  if (statusCode >= 500) {
    console.error('[error]', err)
  }

  return res.status(statusCode).json({
    success: false,
    message,
  })
}

module.exports = { notFoundHandler, errorHandler }
