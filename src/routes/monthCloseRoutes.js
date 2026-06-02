const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/authMiddleware')
const { validateParams } = require('../middlewares/validateParams')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  yearMonthParamsSchema,
  saveMonthCloseBodySchema,
} = require('../validations/monthCloseValidation')
const monthCloseController = require('../controllers/monthCloseController')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/:year/:month',
  validateParams(yearMonthParamsSchema),
  asyncHandler(monthCloseController.getClose),
)

router.put(
  '/:year/:month',
  validateParams(yearMonthParamsSchema),
  validateRequest(saveMonthCloseBodySchema),
  asyncHandler(monthCloseController.saveClose),
)

module.exports = router
