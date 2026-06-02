const { z } = require('zod')

const listUsersQuerySchema = z.object({
  q: z.string().max(50).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

const createAdminUserSchema = z.object({
  username: z.string().trim().min(4).max(50),
  password: z.string().min(6).max(128),
  role: z.enum(['admin', 'user']).optional().default('user'),
})

const updateAdminUserSchema = z
  .object({
    username: z.string().trim().min(4).max(50).optional(),
    role: z.enum(['admin', 'user']).optional(),
    password: z.union([z.string().min(6).max(128), z.literal('')]).optional(),
  })
  .refine((data) => data.username !== undefined || data.role !== undefined || data.password !== undefined, {
    message: 'Enviá al menos un campo para actualizar.',
  })

const userIdParamSchema = z.object({
  userId: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Identificador invalido.'),
})

module.exports = {
  listUsersQuerySchema,
  createAdminUserSchema,
  updateAdminUserSchema,
  userIdParamSchema,
}
