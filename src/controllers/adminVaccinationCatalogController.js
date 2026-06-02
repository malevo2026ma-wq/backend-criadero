const vaccinationCatalogService = require('../services/vaccinationCatalogService')

async function list(_req, res) {
  const items = await vaccinationCatalogService.listAll()
  return res.status(200).json({ success: true, items })
}

async function getByKey(req, res) {
  const item = await vaccinationCatalogService.getByKey(req.params.vaccineKey)
  return res.status(200).json({ success: true, item })
}

async function create(req, res) {
  const item = await vaccinationCatalogService.create(req.body)
  return res.status(201).json({ success: true, item })
}

async function update(req, res) {
  const item = await vaccinationCatalogService.update(req.params.vaccineKey, req.body)
  return res.status(200).json({ success: true, item })
}

async function remove(req, res) {
  const item = await vaccinationCatalogService.deactivate(req.params.vaccineKey)
  return res.status(200).json({ success: true, item })
}

module.exports = { list, getByKey, create, update, remove }
