const { AppError } = require('../utils/AppError')
const { zodFirstMessage } = require('../utils/zodErrorMessage')

function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) {
      const message = zodFirstMessage(parsed.error, 'Parámetros inválidos.')
      return next(new AppError(message, 400))
    }
    req.query = parsed.data
    return next()
  }
}

module.exports = { validateQuery }
