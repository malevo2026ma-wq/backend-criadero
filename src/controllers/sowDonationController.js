const sowDonationService = require('../services/sowDonationService')

async function listCandidates(req, res) {
  const data = await sowDonationService.listCandidates(req.query)
  return res.status(200).json({ success: true, ...data })
}

async function create(req, res) {
  const data = await sowDonationService.createDonation(req.body, req.auth?.userId ?? null)
  return res.status(201).json({ success: true, ...data })
}

async function remove(req, res) {
  const data = await sowDonationService.removeDonation(req.params.donationId)
  return res.status(200).json({ success: true, ...data })
}

module.exports = { listCandidates, create, remove }
