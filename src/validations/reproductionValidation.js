const { z } = require('zod')

const rodeoQuerySchema = z.object({
  status: z
    .enum(['all', 'pregnant', 'near_parto', 'lactating', 'pending', 'ready', 'inactive'])
    .optional(),
  phase: z
    .enum([
      'all',
      'no_service',
      'need_fs',
      'parto',
      'nacidos',
      'destete_fecha',
      'destete_detalle',
      'cycle_complete',
    ])
    .optional(),
  q: z.string().max(64).optional(),
})

const calendarQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(120).optional(),
})

module.exports = {
  rodeoQuerySchema,
  calendarQuerySchema,
}
