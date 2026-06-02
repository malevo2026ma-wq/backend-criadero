const { z } = require('zod')

const listVaccinationsQuerySchema = z.object({
  category: z.enum(['gestacion', 'maternidad_hembra', 'maternidad_lechon']).optional(),
  sowNumber: z.string().max(50).optional().default(''),
  includeCompletedDays: z.coerce.number().int().min(0).max(90).optional().default(14),
})

const patchVaccinationSchema = z
  .object({
    administeredDate: z.union([z.string(), z.null()]).optional(),
    batchNo: z.string().max(80).optional(),
    notes: z.string().max(4000).optional(),
    skipped: z.boolean().optional(),
    /** Si true, permite guardar aunque la fecha quede fuera de la ventana del protocolo. */
    outsideWindow: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.administeredDate !== undefined ||
      d.batchNo !== undefined ||
      d.notes !== undefined ||
      d.skipped !== undefined,
    { message: 'Enviá al menos un campo para actualizar.' },
  )

const vaccinationIdParamSchema = z.object({
  vaccinationId: z
    .string()
    .trim()
    .min(30)
    .max(40),
})

module.exports = {
  listVaccinationsQuerySchema,
  patchVaccinationSchema,
  vaccinationIdParamSchema,
}
