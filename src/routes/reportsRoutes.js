const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/authMiddleware')
const { validateQuery } = require('../middlewares/validateQuery')
const { birthsWeaningsQuerySchema } = require('../validations/reportsValidation')
const reportsController = require('../controllers/reportsController')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/births-weanings',
  validateQuery(birthsWeaningsQuerySchema),
  asyncHandler(reportsController.birthsWeanings),
)

module.exports = router
