const vaccinationService = require('../services/vaccinationService')

async function list(req, res) {
  const rows = await vaccinationService.listDashboard(req.query)
  return res.status(200).json({ success: true, items: rows })
}

async function protocol(_req, res) {
  const data = await vaccinationService.getProtocolCatalog()
  return res.status(200).json({ success: true, ...data })
}

async function rebuild(_req, res) {
  const result = await vaccinationService.rebuildAllSowVaccinations()
  return res.status(200).json({ success: true, ...result })
}

async function patch(req, res) {
  const row = await vaccinationService.patchVaccination(req.params.vaccinationId, req.body)
  return res.status(200).json({ success: true, vaccination: row })
}

module.exports = { list, protocol, rebuild, patch }
