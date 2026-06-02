const { z } = require('zod')

const feedKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9_]+$/, 'Clave de alimento inválida.')

const yearMonthParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

const openingBalancesSchema = z.object({
  balances: z.record(z.string(), z.coerce.number().min(0)),
})

const createEntrySchema = z.object({
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  feedKey: feedKeySchema,
  quantity: z.coerce.number().positive(),
  notes: z.string().max(500).optional().nullable(),
})

const updateEntrySchema = z
  .object({
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    feedKey: feedKeySchema.optional(),
    quantity: z.coerce.number().positive().optional(),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Enviá al menos un campo para actualizar.' })

const entryIdParamSchema = z.object({
  entryId: z.string().trim().min(30).max(40),
})

const historyQuerySchema = z.object({
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  feedKey: feedKeySchema.optional(),
})

module.exports = {
  yearMonthParamsSchema,
  openingBalancesSchema,
  createEntrySchema,
  updateEntrySchema,
  entryIdParamSchema,
  historyQuerySchema,
  feedKeySchema,
}
