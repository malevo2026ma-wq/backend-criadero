const { z } = require('zod')

const registerSchema = z.object({
  username: z.string().trim().min(4).max(50),
  password: z.string().min(6).max(128),
})

const loginSchema = z.object({
  username: z.string().trim().min(4).max(50),
  password: z.string().min(6).max(128),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
})

module.exports = { registerSchema, loginSchema, refreshSchema }
