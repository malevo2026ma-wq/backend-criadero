const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/authMiddleware')
const { validateParams } = require('../middlewares/validateParams')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  yearMonthParamsSchema,
  dayStageParamsSchema,
  openingBodySchema,
  dayStageBodySchema,
  transferBodySchema,
  deathsBodySchema,
} = require('../validations/fatteningValidation')
const fatteningController = require('../controllers/fatteningController')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/:year/:month',
  validateParams(yearMonthParamsSchema),
  asyncHandler(fatteningController.getSheet),
)

router.put(
  '/:year/:month/opening',
  validateParams(yearMonthParamsSchema),
  validateRequest(openingBodySchema),
  asyncHandler(fatteningController.putOpening),
)

router.put(
  '/:year/:month/day/:day/:stage',
  validateParams(dayStageParamsSchema),
  validateRequest(dayStageBodySchema),
  asyncHandler(fatteningController.putDayStage),
)

router.post(
  '/:year/:month/transfer',
  validateParams(yearMonthParamsSchema),
  validateRequest(transferBodySchema),
  asyncHandler(fatteningController.postTransfer),
)

router.post(
  '/:year/:month/deaths',
  validateParams(yearMonthParamsSchema),
  validateRequest(deathsBodySchema),
  asyncHandler(fatteningController.postDeaths),
)

router.get(
  '/:year/:month/movements',
  validateParams(yearMonthParamsSchema),
  asyncHandler(fatteningController.getMovements),
)

module.exports = router
