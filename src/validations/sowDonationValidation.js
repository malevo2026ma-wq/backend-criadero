const { z } = require('zod')

const cycleIdSchema = z.string().trim().min(10).max(40)

const donationCandidatesQuerySchema = z
  .object({
    excludeSowId: cycleIdSchema.optional(),
    excludeCycleId: cycleIdSchema.optional(),
  })
  .transform((q) => ({
    excludeSowId: q.excludeSowId,
    excludeCycleId: q.excludeCycleId,
  }))

const createDonationSchema = z.object({
  fromCycleId: cycleIdSchema,
  toCycleId: cycleIdSchema,
  quantity: z.coerce.number().int().min(1).max(99),
  donationDate: z.string().max(32).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})

const donationIdParamSchema = z.object({
  donationId: cycleIdSchema,
})

module.exports = {
  donationCandidatesQuerySchema,
  createDonationSchema,
  donationIdParamSchema,
}
