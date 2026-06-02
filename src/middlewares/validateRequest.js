const { AppError } = require('../utils/AppError')

function validateRequest(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Datos invalidos.'
      return next(new AppError(message, 400))
    }

    req.body = parsed.data
    return next()
  }
}

module.exports = { validateRequest }
