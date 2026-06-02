const { z } = require('zod')
const { feedKeySchema } = require('./feedValidation')

const movementQuerySchema = z.object({
  feedKey: feedKeySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const createMovementSchema = z
  .object({
    feedKey: feedKeySchema,
    movementType: z.enum(['in', 'out', 'adjust']),
    quantity: z.coerce.number().optional(),
    targetStock: z.coerce.number().optional(),
    notes: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === 'adjust') {
      if (data.targetStock == null && data.quantity == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Indicá el stock objetivo (targetStock).',
          path: ['targetStock'],
        })
      } else if (data.targetStock != null && !Number.isFinite(Number(data.targetStock))) {
        ctx.addIssue({
          code: 'custom',
          message: 'Stock objetivo inválido.',
          path: ['targetStock'],
        })
      }
      return
    }
    const q = Number(data.quantity)
    if (!Number.isFinite(q) || q <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'La cantidad debe ser mayor a cero.',
        path: ['quantity'],
      })
    }
  })

const createFeedTypeSchema = z.object({
  feedKey: feedKeySchema.optional(),
  label: z.string().trim().min(2).max(120),
  shortLabel: z.string().trim().min(1).max(40).optional(),
  sortOrder: z.coerce.number().int().optional(),
})

const updateFeedTypeSchema = z
  .object({
    label: z.string().trim().min(2).max(120).optional(),
    shortLabel: z.string().trim().min(1).max(40).optional(),
    sortOrder: z.coerce.number().int().optional(),
    active: z.boolean().optional(),
    isPrepared: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Enviá al menos un campo.' })

const createFeedTypeSchemaExtended = createFeedTypeSchema.extend({
  isPrepared: z.boolean().optional(),
})

const ingredientKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9_]+$/, 'Clave inválida.')

const createIngredientMovementSchema = z
  .object({
    ingredientKey: ingredientKeySchema,
    movementType: z.enum(['in', 'out', 'adjust']),
    quantity: z.coerce.number().optional(),
    targetStock: z.coerce.number().optional(),
    notes: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === 'adjust') {
      if (data.targetStock == null && data.quantity == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Indicá el stock objetivo (targetStock).',
          path: ['targetStock'],
        })
      } else if (data.targetStock != null && !Number.isFinite(Number(data.targetStock))) {
        ctx.addIssue({
          code: 'custom',
          message: 'Stock objetivo inválido.',
          path: ['targetStock'],
        })
      }
      return
    }
    const q = Number(data.quantity)
    if (!Number.isFinite(q) || q <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'La cantidad debe ser mayor a cero.',
        path: ['quantity'],
      })
    }
  })

const createIngredientTypeSchema = z.object({
  ingredientKey: ingredientKeySchema.optional(),
  label: z.string().trim().min(2).max(160),
  shortLabel: z.string().trim().min(1).max(48).optional(),
  sortOrder: z.coerce.number().int().optional(),
})

const updateIngredientTypeSchema = z
  .object({
    label: z.string().trim().min(2).max(160).optional(),
    shortLabel: z.string().trim().min(1).max(48).optional(),
    sortOrder: z.coerce.number().int().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Enviá al menos un campo.' })

const ingredientKeyParamSchema = z.object({
  ingredientKey: ingredientKeySchema,
})

const ingredientMovementQuerySchema = z.object({
  ingredientKey: ingredientKeySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const productionPreviewSchema = z.object({
  feedKey: feedKeySchema,
  quantity: z.coerce.number().positive(),
})

const recipeLineSchema = z.object({
  ingredientKey: ingredientKeySchema,
  partsPerBatch: z.coerce.number().min(0),
  sortOrder: z.coerce.number().int().optional(),
})

const saveRecipeSchema = z
  .object({
    isPrepared: z.boolean().optional(),
    batchSizeKg: z.coerce.number().positive().optional(),
    lines: z.array(recipeLineSchema).max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isPrepared === true) {
      const lines = data.lines ?? []
      const valid = lines.filter(
        (l) =>
          l.ingredientKey &&
          Number.isFinite(Number(l.partsPerBatch)) &&
          Number(l.partsPerBatch) >= 0,
      )
      if (valid.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Indicá al menos un ingrediente en la fórmula.',
          path: ['lines'],
        })
      }
    }
  })

const feedKeyParamSchema = z.object({
  feedKey: feedKeySchema,
})

module.exports = {
  movementQuerySchema,
  createMovementSchema,
  createFeedTypeSchema: createFeedTypeSchemaExtended,
  updateFeedTypeSchema,
  feedKeyParamSchema,
  createIngredientMovementSchema,
  createIngredientTypeSchema,
  updateIngredientTypeSchema,
  ingredientKeyParamSchema,
  ingredientMovementQuerySchema,
  productionPreviewSchema,
  saveRecipeSchema,
}
