const { AppError } = require('../utils/AppError')
const { verifyAccessToken } = require('../utils/tokens')

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    return next(new AppError('No autenticado.', 401))
  }

  try {
    const payload = verifyAccessToken(token)
    req.auth = { userId: payload.sub, username: payload.username, role: payload.role }
    return next()
  } catch {
    return next(new AppError('Token invalido o expirado.', 401))
  }
}

function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return next(new AppError('No autorizado para esta accion.', 403))
    }
    return next()
  }
}

module.exports = { requireAuth, requireRole }
