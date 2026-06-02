const { z } = require('zod')

const yearMonthParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

const optionalNumber = z.union([z.number(), z.string(), z.null()]).optional()

const saveMonthCloseBodySchema = z.object({
  producer: z.string().max(120).optional().default(''),
  closeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  manualData: z.record(z.string(), z.unknown()).optional().default({}),
})

module.exports = {
  yearMonthParamsSchema,
  saveMonthCloseBodySchema,
}
