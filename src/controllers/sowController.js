const sowService = require('../services/sowService')

async function list(req, res) {
  const sows = await sowService.listSows(req.query)
  return res.status(200).json({ success: true, sows })
}

async function dashboardStats(req, res) {
  const stats = await sowService.getDashboardStats()
  return res.status(200).json({ success: true, stats })
}

async function homeAlerts(req, res) {
  const alerts = await sowService.getHomeAlerts()
  return res.status(200).json({ success: true, ...alerts })
}

async function getById(req, res) {
  const sow = await sowService.getSowById(req.params.sowId)
  return res.status(200).json({ success: true, sow })
}

async function create(req, res) {
  const sow = await sowService.createSow(req.body)
  return res.status(201).json({ success: true, sow })
}

async function update(req, res) {
  const sow = await sowService.updateSow(req.params.sowId, req.body)
  return res.status(200).json({ success: true, sow })
}

module.exports = { list, dashboardStats, homeAlerts, getById, create, update }
