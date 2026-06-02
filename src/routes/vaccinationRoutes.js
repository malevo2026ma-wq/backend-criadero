const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth, requireRole } = require('../middlewares/authMiddleware')
const { validateQuery } = require('../middlewares/validateQuery')
const { validateRequest } = require('../middlewares/validateRequest')
const { validateParams } = require('../middlewares/validateParams')
const {
  listVaccinationsQuerySchema,
  patchVaccinationSchema,
  vaccinationIdParamSchema,
} = require('../validations/vaccinationValidation')
const vaccinationController = require('../controllers/vaccinationController')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/',
  validateQuery(listVaccinationsQuerySchema),
  asyncHandler(vaccinationController.list),
)
router.get('/protocol', asyncHandler(vaccinationController.protocol))
router.post(
  '/rebuild',
  requireRole('admin'),
  asyncHandler(vaccinationController.rebuild),
)
router.patch(
  '/:vaccinationId',
  validateParams(vaccinationIdParamSchema),
  validateRequest(patchVaccinationSchema),
  asyncHandler(vaccinationController.patch),
)

module.exports = router
