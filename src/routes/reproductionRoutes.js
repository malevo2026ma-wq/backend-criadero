const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/authMiddleware')
const { validateQuery } = require('../middlewares/validateQuery')
const {
  rodeoQuerySchema,
  calendarQuerySchema,
} = require('../validations/reproductionValidation')
const reproductionController = require('../controllers/reproductionController')

const router = express.Router()

router.use(requireAuth)

router.get('/overview', asyncHandler(reproductionController.overview))
router.get('/rodeo', validateQuery(rodeoQuerySchema), asyncHandler(reproductionController.rodeo))
router.get(
  '/calendar',
  validateQuery(calendarQuerySchema),
  asyncHandler(reproductionController.calendar),
)

module.exports = router
