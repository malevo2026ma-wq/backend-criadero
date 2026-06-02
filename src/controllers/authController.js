const authService = require('../services/authService')

async function register(req, res) {
  const data = await authService.register(req.body)
  return res.status(201).json({ success: true, ...data })
}

async function login(req, res) {
  const data = await authService.login(req.body)
  return res.status(200).json({ success: true, ...data })
}

async function refresh(req, res) {
  const data = await authService.refresh(req.body.refreshToken)
  return res.status(200).json({ success: true, ...data })
}

async function logout(req, res) {
  await authService.logout(req.auth.userId)
  return res.status(200).json({ success: true, message: 'Sesion cerrada.' })
}

async function me(req, res) {
  const user = await authService.getMe(req.auth.userId)
  return res.status(200).json({ success: true, user })
}

module.exports = { register, login, refresh, logout, me }
