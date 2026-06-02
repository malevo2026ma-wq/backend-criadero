const fatteningService = require('../services/fatteningService')
const { movementsQuerySchema } = require('../validations/fatteningValidation')

async function getSheet(req, res) {
  const { year, month } = req.params
  const sheet = await fatteningService.getOrCreateMonth(Number(year), Number(month))
  return res.status(200).json({ success: true, sheet })
}

async function putOpening(req, res) {
  const { year, month } = req.params
  const sheet = await fatteningService.updateOpeningBalances(
    Number(year),
    Number(month),
    req.body.opening,
    req.body.notes,
  )
  return res.status(200).json({ success: true, sheet })
}

async function putDayStage(req, res) {
  const { year, month, day, stage } = req.params
  const sheet = await fatteningService.updateDayStage(
    Number(year),
    Number(month),
    Number(day),
    stage,
    req.body,
  )
  return res.status(200).json({ success: true, sheet })
}

async function postTransfer(req, res) {
  const { year, month } = req.params
  const sheet = await fatteningService.registerTransfer(Number(year), Number(month), req.body)
  return res.status(200).json({ success: true, sheet })
}

async function postDeaths(req, res) {
  const { year, month } = req.params
  const sheet = await fatteningService.registerDeaths(Number(year), Number(month), req.body)
  return res.status(200).json({ success: true, sheet })
}

async function getMovements(req, res) {
  const { year, month } = req.params
  const parsed = movementsQuerySchema.safeParse(req.query)
  const filters = parsed.success ? parsed.data : {}
  const data = await fatteningService.listMovements(Number(year), Number(month), filters)
  return res.status(200).json({ success: true, ...data })
}

module.exports = {
  getSheet,
  putOpening,
  putDayStage,
  postTransfer,
  postDeaths,
  getMovements,
}
