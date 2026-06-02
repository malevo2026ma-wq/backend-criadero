const { z } = require('zod')

const yearMonthParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

const dayStageParamsSchema = yearMonthParamsSchema.extend({
  day: z.coerce.number().int().min(1).max(31),
  stage: z.enum(['maternidad', 'recria', 'desarrollo', 'terminacion']),
})

const openingBodySchema = z.object({
  opening: z.object({
    maternidad: z.coerce.number().int().min(0).default(0),
    recria: z.coerce.number().int().min(0).default(0),
    desarrollo: z.coerce.number().int().min(0).default(0),
    terminacion: z.coerce.number().int().min(0).default(0),
  }),
  notes: z.string().max(2000).optional().nullable(),
})

const dayStageBodySchema = z.object({
  manualIngreso: z.coerce.number().int().min(0).default(0),
  manualDeaths: z.coerce.number().int().min(0).default(0),
  manualSalida: z.coerce.number().int().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
})

const transferBodySchema = z.object({
  day: z.coerce.number().int().min(1).max(31),
  fromStage: z.enum(['maternidad', 'recria', 'desarrollo', 'terminacion']),
  toStage: z.enum(['maternidad', 'recria', 'desarrollo', 'terminacion']),
  quantity: z.coerce.number().int().min(1),
})

const deathsBodySchema = z.object({
  day: z.coerce.number().int().min(1).max(31),
  stage: z.enum(['maternidad', 'recria', 'desarrollo', 'terminacion']),
  quantity: z.coerce.number().int().min(1),
  notes: z.string().max(500).optional().nullable(),
})

const movementsQuerySchema = z.object({
  day: z.coerce.number().int().min(1).max(31).optional(),
  stage: z.enum(['maternidad', 'recria', 'desarrollo', 'terminacion']).optional(),
})

module.exports = {
  yearMonthParamsSchema,
  dayStageParamsSchema,
  openingBodySchema,
  dayStageBodySchema,
  transferBodySchema,
  deathsBodySchema,
  movementsQuerySchema,
}
