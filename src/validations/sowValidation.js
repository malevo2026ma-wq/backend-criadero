const { z } = require('zod')

const idString = z.string().trim().min(10).max(40)

const cycleSchema = z.object({
  id: idString,
  fDtt: z.string().max(64).optional().default(''),
  idc: z.string().max(64).optional().default(''),
  fs: z.string().max(64).optional().default(''),
  maleNo: z.string().max(80).optional().default(''),
  fpp: z.string().max(64).optional().default(''),
  frp: z.string().max(64).optional().default(''),
  bornAlive: z.string().max(32).optional().default(''),
  bornDead: z.string().max(32).optional().default(''),
  bornFetuses: z.string().max(32).optional().default(''),
  bornTotal: z.string().max(32).optional().default(''),
  deadLactation: z.string().max(32).optional().default(''),
  weanDate: z.string().max(64).optional().default(''),
  weanQty: z.string().max(32).optional().default(''),
  weanAvgWeight: z.string().max(64).optional().default(''),
  weanDaysLactation: z.string().max(32).optional().default(''),
  observations: z.string().max(4000).optional().default(''),
  repeatEstrus: z.boolean().optional().default(false),
})

const createSowSchema = z.object({
  number: z.string().trim().min(1).max(50),
  entryDate: z.string().max(64).optional().default(''),
  birthDate: z.string().max(64).optional().default(''),
  serviceDate: z.string().max(64).optional().default(''),
  breed: z.string().max(80).optional().default(''),
  cycles: z.array(cycleSchema).optional().default([]),
})

const updateSowSchema = z.object({
  id: idString,
  number: z.string().trim().min(1).max(50),
  entryDate: z.string().max(64).optional().default(''),
  birthDate: z.string().max(64).optional().default(''),
  serviceDate: z.string().max(64).optional().default(''),
  breed: z.string().max(80).optional().default(''),
  cycles: z.array(cycleSchema),
})

const listSowsQuerySchema = z
  .object({
    number: z.string().max(50).optional(),
  })
  .transform((q) => ({
    number: q.number?.trim() ? q.number.trim() : undefined,
  }))

module.exports = {
  cycleSchema,
  createSowSchema,
  updateSowSchema,
  listSowsQuerySchema,
}
