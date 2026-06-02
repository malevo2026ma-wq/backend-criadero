const reportsService = require('../services/reportsService')

async function birthsWeanings(req, res) {
  const { from, to } = req.query
  const data = await reportsService.getBirthsWeaningsReport(from, to)
  return res.status(200).json({ success: true, report: data })
}

module.exports = {
  birthsWeanings,
}
