const { AppError } = require('../utils/AppError')

function validateParams(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.params)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Parametros invalidos.'
      return next(new AppError(message, 400))
    }
    req.params = parsed.data
    return next()
  }
}

module.exports = { validateParams }
