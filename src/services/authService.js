const bcrypt = require('bcryptjs')
const { AppError } = require('../utils/AppError')
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/tokens')
const {
  createUser,
  findByUsername,
  findById,
  updateRefreshTokenHash,
} = require('../models/userModel')
const { env } = require('../config/env')
const { ROLES } = require('../constants/roles')

function buildAuthPayload(user) {
  return {
    sub: String(user.id),
    username: user.username,
    role: user.role,
  }
}

async function createSessionForUser(user) {
  const payload = buildAuthPayload(user)
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
  await updateRefreshTokenHash(user.id, refreshTokenHash)

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  }
}

async function register({ username, password }) {
  if (!env.allowPublicRegister) {
    throw new AppError('El registro público está deshabilitado. Contactá al administrador.', 403)
  }

  const existingUser = await findByUsername(username)
  if (existingUser) {
    throw new AppError('El usuario ya existe.', 409)
  }

  const role = ROLES.USER
  const passwordHash = await bcrypt.hash(password, 12)
  const userId = await createUser({ username, passwordHash, role })
  const createdUser = { id: userId, username, role }

  return createSessionForUser(createdUser)
}

async function login({ username, password }) {
  const user = await findByUsername(username)
  if (!user) {
    throw new AppError('Credenciales invalidas.', 401)
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash)
  if (!isValidPassword) {
    throw new AppError('Credenciales invalidas.', 401)
  }

  return createSessionForUser(user)
}

async function refresh(refreshToken) {
  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw new AppError('Refresh token invalido o expirado.', 401)
  }

  const user = await findById(payload.sub)
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404)
  }

  const userWithAuth = await findByUsername(user.username)
  const hasStoredToken = Boolean(userWithAuth?.refreshTokenHash)
  if (!hasStoredToken) {
    throw new AppError('Sesion invalida.', 401)
  }

  const isRefreshMatch = await bcrypt.compare(
    refreshToken,
    userWithAuth.refreshTokenHash,
  )
  if (!isRefreshMatch) {
    throw new AppError('Sesion invalida.', 401)
  }

  return createSessionForUser(user)
}

async function logout(userId) {
  await updateRefreshTokenHash(userId, null)
  return { success: true }
}

async function getMe(userId) {
  const user = await findById(userId)
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404)
  }
  return user
}

module.exports = { register, login, refresh, logout, getMe }
