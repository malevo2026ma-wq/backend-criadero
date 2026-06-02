const monthCloseService = require('../services/monthCloseService')

async function getClose(req, res) {
  const { year, month } = req.params
  const data = await monthCloseService.getMonthClose(Number(year), Number(month))
  return res.status(200).json({ success: true, close: data })
}

async function saveClose(req, res) {
  const { year, month } = req.params
  const data = await monthCloseService.saveMonthClose(
    Number(year),
    Number(month),
    req.body,
    req.user?.id,
  )
  return res.status(200).json({ success: true, ...data })
}

module.exports = {
  getClose,
  saveClose,
}
