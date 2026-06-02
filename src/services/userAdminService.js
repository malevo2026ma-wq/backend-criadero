const bcrypt = require('bcryptjs')
const { AppError } = require('../utils/AppError')
const {
  createUser,
  findById,
  listUsers,
  countAdmins,
  findUsernameConflict,
  updateUserRecord,
  deleteUserById,
} = require('../models/userModel')
const { ROLES } = require('../constants/roles')

function normalizeId(id) {
  const s = String(id ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  return s
}

function serializeUser(row) {
  if (!row) return null
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt
  return {
    id: String(row.id),
    username: row.username,
    role: row.role,
    createdAt: createdAt || null,
    updatedAt: updatedAt || null,
  }
}

async function list({ q = '', page = 1, pageSize = 20 }) {
  const limit = Math.min(100, Math.max(1, pageSize))
  const p = Math.max(1, page)
  const offset = (p - 1) * limit
  const { users, total } = await listUsers({ search: q, limit, offset })
  return {
    users: users.map(serializeUser),
    total,
    page: p,
    pageSize: limit,
  }
}

async function createUserByAdmin({ username, password, role }) {
  const conflict = await findUsernameConflict(username)
  if (conflict) {
    throw new AppError('Ya existe un usuario con ese nombre.', 409)
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const insertId = await createUser({
    username,
    passwordHash,
    role: role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER,
  })
  const created = await findById(insertId)
  return serializeUser(created)
}

async function updateUserByAdmin(actorUserId, targetUserId, { username, role, password }) {
  const id = normalizeId(targetUserId)
  if (!id) {
    throw new AppError('Identificador de usuario invalido.', 400)
  }

  const existing = await findById(id)
  if (!existing) {
    throw new AppError('Usuario no encontrado.', 404)
  }

  const nextUsername = username !== undefined ? String(username).trim() : existing.username
  if (nextUsername.length < 4 || nextUsername.length > 50) {
    throw new AppError('El nombre de usuario debe tener entre 4 y 50 caracteres.', 400)
  }

  const nextRole =
    role !== undefined
      ? role === ROLES.ADMIN
        ? ROLES.ADMIN
        : ROLES.USER
      : existing.role

  const conflict = await findUsernameConflict(nextUsername, id)
  if (conflict) {
    throw new AppError('Ya existe un usuario con ese nombre.', 409)
  }

  const wasAdmin = existing.role === ROLES.ADMIN
  const demotingAdmin = wasAdmin && nextRole === ROLES.USER
  if (demotingAdmin) {
    const admins = await countAdmins()
    if (admins <= 1) {
      throw new AppError('No se puede quitar el rol administrador al unico admin del sistema.', 400)
    }
  }

  let passwordHash = null
  if (password !== undefined && String(password).trim() !== '') {
    if (String(password).length < 6) {
      throw new AppError('La contraseña debe tener al menos 6 caracteres.', 400)
    }
    passwordHash = await bcrypt.hash(String(password), 12)
  }

  await updateUserRecord(id, {
    username: nextUsername,
    role: nextRole,
    passwordHash,
  })

  const updated = await findById(id)
  return serializeUser(updated)
}

async function deleteUserByAdmin(actorUserId, targetUserId) {
  const actor = normalizeId(actorUserId)
  const id = normalizeId(targetUserId)
  if (!id) {
    throw new AppError('Identificador de usuario invalido.', 400)
  }

  if (actor === id) {
    throw new AppError('No podes eliminar tu propia cuenta.', 400)
  }

  const existing = await findById(id)
  if (!existing) {
    throw new AppError('Usuario no encontrado.', 404)
  }

  if (existing.role === ROLES.ADMIN) {
    const admins = await countAdmins()
    if (admins <= 1) {
      throw new AppError('No se puede eliminar al unico administrador del sistema.', 400)
    }
  }

  const ok = await deleteUserById(id)
  if (!ok) {
    throw new AppError('No se pudo eliminar el usuario.', 500)
  }
  return { success: true }
}

module.exports = {
  list,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
}
