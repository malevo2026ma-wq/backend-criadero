const userAdminService = require('../services/userAdminService')

async function list(req, res) {
  const payload = await userAdminService.list(req.query)
  return res.status(200).json({ success: true, ...payload })
}

async function create(req, res) {
  const user = await userAdminService.createUserByAdmin(req.body)
  return res.status(201).json({ success: true, user })
}

async function update(req, res) {
  const user = await userAdminService.updateUserByAdmin(req.auth.userId, req.params.userId, req.body)
  return res.status(200).json({ success: true, user })
}

async function remove(req, res) {
  const result = await userAdminService.deleteUserByAdmin(req.auth.userId, req.params.userId)
  return res.status(200).json({ success: true, ...result })
}

module.exports = { list, create, update, remove }
