const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/authMiddleware')
const { validateRequest } = require('../middlewares/validateRequest')
const { validateQuery } = require('../middlewares/validateQuery')
const {
  createSowSchema,
  updateSowSchema,
  listSowsQuerySchema,
} = require('../validations/sowValidation')
const sowController = require('../controllers/sowController')
const sowDonationController = require('../controllers/sowDonationController')
const { validateParams } = require('../middlewares/validateParams')
const {
  donationCandidatesQuerySchema,
  createDonationSchema,
  donationIdParamSchema,
} = require('../validations/sowDonationValidation')

const router = express.Router()

router.use(requireAuth)

router.get('/dashboard-stats', asyncHandler(sowController.dashboardStats))
router.get('/home-alerts', asyncHandler(sowController.homeAlerts))
router.get(
  '/lactation-donation-candidates',
  validateQuery(donationCandidatesQuerySchema),
  asyncHandler(sowDonationController.listCandidates),
)
router.post(
  '/piglet-donations',
  validateRequest(createDonationSchema),
  asyncHandler(sowDonationController.create),
)
router.delete(
  '/piglet-donations/:donationId',
  validateParams(donationIdParamSchema),
  asyncHandler(sowDonationController.remove),
)
router.get(
  '/',
  validateQuery(listSowsQuerySchema),
  asyncHandler(sowController.list),
)
router.get('/:sowId', asyncHandler(sowController.getById))
router.post('/', validateRequest(createSowSchema), asyncHandler(sowController.create))
router.put(
  '/:sowId',
  validateRequest(updateSowSchema),
  asyncHandler(sowController.update),
)

module.exports = router
