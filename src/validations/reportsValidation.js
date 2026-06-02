const { z } = require('zod')

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (use YYYY-MM-DD).')

const birthsWeaningsQuerySchema = z
  .object({
    from: isoDateString,
    to: isoDateString,
  })
  .refine((q) => q.from <= q.to, {
    message: 'La fecha desde no puede ser posterior a la fecha hasta.',
    path: ['from'],
  })

module.exports = {
  birthsWeaningsQuerySchema,
}
