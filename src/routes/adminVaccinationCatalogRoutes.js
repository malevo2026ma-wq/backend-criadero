const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { validateRequest } = require('../middlewares/validateRequest')
const { validateParams } = require('../middlewares/validateParams')
const {
  vaccineKeyParamSchema,
  createCatalogItemSchema,
  updateCatalogItemSchema,
} = require('../validations/adminVaccinationCatalogValidation')
const adminVaccinationCatalogController = require('../controllers/adminVaccinationCatalogController')

const router = express.Router()

router.get('/', asyncHandler(adminVaccinationCatalogController.list))
router.get(
  '/:vaccineKey',
  validateParams(vaccineKeyParamSchema),
  asyncHandler(adminVaccinationCatalogController.getByKey),
)
router.post(
  '/',
  validateRequest(createCatalogItemSchema),
  asyncHandler(adminVaccinationCatalogController.create),
)
router.put(
  '/:vaccineKey',
  validateParams(vaccineKeyParamSchema),
  validateRequest(updateCatalogItemSchema),
  asyncHandler(adminVaccinationCatalogController.update),
)
router.delete(
  '/:vaccineKey',
  validateParams(vaccineKeyParamSchema),
  asyncHandler(adminVaccinationCatalogController.remove),
)

module.exports = router
