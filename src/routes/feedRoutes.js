const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/authMiddleware')
const { validateRequest } = require('../middlewares/validateRequest')
const { validateParams } = require('../middlewares/validateParams')
const { validateQuery } = require('../middlewares/validateQuery')
const {
  yearMonthParamsSchema,
  openingBalancesSchema,
  createEntrySchema,
  updateEntrySchema,
  entryIdParamSchema,
  historyQuerySchema,
} = require('../validations/feedValidation')
const feedController = require('../controllers/feedController')

const router = express.Router()

router.use(requireAuth)

router.get('/catalog', asyncHandler(feedController.catalog))
router.get('/months', asyncHandler(feedController.listMonths))

router.get(
  '/months/:year/:month/history',
  validateParams(yearMonthParamsSchema),
  validateQuery(historyQuerySchema),
  asyncHandler(feedController.history),
)

router.get(
  '/months/:year/:month',
  validateParams(yearMonthParamsSchema),
  asyncHandler(feedController.getMonth),
)

router.patch(
  '/months/:year/:month/opening-balances',
  validateParams(yearMonthParamsSchema),
  validateRequest(openingBalancesSchema),
  asyncHandler(feedController.patchOpening),
)

router.post(
  '/months/:year/:month/entries',
  validateParams(yearMonthParamsSchema),
  validateRequest(createEntrySchema),
  asyncHandler(feedController.createEntry),
)

router.patch(
  '/entries/:entryId',
  validateParams(entryIdParamSchema),
  validateRequest(updateEntrySchema),
  asyncHandler(feedController.updateEntry),
)

router.delete(
  '/entries/:entryId',
  validateParams(entryIdParamSchema),
  asyncHandler(feedController.deleteEntry),
)

module.exports = router
