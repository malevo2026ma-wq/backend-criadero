const feedService = require('../services/feedService')

async function catalog(_req, res) {
  const data = await feedService.getCatalog()
  return res.status(200).json({ success: true, ...data })
}

async function listMonths(_req, res) {
  const months = await feedService.listMonths()
  return res.status(200).json({ success: true, months })
}

async function getMonth(req, res) {
  const { year, month } = req.params
  const sheet = await feedService.getOrCreateMonth(year, month, { createIfMissing: true })
  return res.status(200).json({ success: true, ...sheet })
}

async function patchOpening(req, res) {
  const { year, month } = req.params
  const sheet = await feedService.updateOpeningBalances(year, month, req.body.balances)
  return res.status(200).json({ success: true, ...sheet })
}

async function createEntry(req, res) {
  const { year, month } = req.params
  const result = await feedService.addEntry(year, month, req.body)
  return res.status(201).json({ success: true, ...result })
}

async function updateEntry(req, res) {
  const result = await feedService.updateEntry(req.params.entryId, req.body)
  return res.status(200).json({ success: true, ...result })
}

async function deleteEntry(req, res) {
  const result = await feedService.removeEntry(req.params.entryId)
  return res.status(200).json({ success: true, ...result })
}

async function history(req, res) {
  const { year, month } = req.params
  const data = await feedService.getHistory(year, month, req.query)
  return res.status(200).json({ success: true, ...data })
}

module.exports = {
  catalog,
  listMonths,
  getMonth,
  patchOpening,
  createEntry,
  updateEntry,
  deleteEntry,
  history,
}
