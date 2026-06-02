const { z } = require('zod')

const CATEGORY = z.enum(['gestacion', 'maternidad_hembra', 'maternidad_lechon'])
const ANCHOR = z.enum(['fs', 'frp'])

const vaccineKeyParamSchema = z.object({
  vaccineKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/i, 'Clave: solo letras, números y guión bajo.'),
})

const createCatalogItemSchema = z.object({
  vaccineKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/i),
  category: CATEGORY,
  sortOrder: z.coerce.number().int().min(0),
  label: z.string().trim().min(1).max(255),
  doseText: z.string().max(255).optional().default(''),
  isOptional: z.boolean().optional().default(false),
  anchor: ANCHOR,
  dayOffset: z.coerce.number().int(),
  windowEndOffset: z.union([z.coerce.number().int(), z.null()]).optional(),
  active: z.boolean().optional(),
})

const updateCatalogItemSchema = z
  .object({
    category: CATEGORY.optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    label: z.string().trim().min(1).max(255).optional(),
    doseText: z.string().max(255).optional(),
    isOptional: z.boolean().optional(),
    anchor: ANCHOR.optional(),
    dayOffset: z.coerce.number().int().optional(),
    windowEndOffset: z.union([z.coerce.number().int(), z.null()]).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Enviá al menos un campo para actualizar.' })

module.exports = {
  vaccineKeyParamSchema,
  createCatalogItemSchema,
  updateCatalogItemSchema,
}
