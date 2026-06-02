const reproductionService = require('../services/reproductionService')

async function overview(_req, res) {
  const data = await reproductionService.getOverview()
  return res.status(200).json({ success: true, ...data })
}

async function rodeo(req, res) {
  const data = await reproductionService.listRodeo(req.query)
  return res.status(200).json({ success: true, ...data })
}

async function calendar(req, res) {
  const data = await reproductionService.getCalendar(req.query)
  return res.status(200).json({ success: true, ...data })
}

module.exports = {
  overview,
  rodeo,
  calendar,
}
