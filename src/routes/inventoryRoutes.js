const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/authMiddleware')
const { validateRequest } = require('../middlewares/validateRequest')
const { validateParams } = require('../middlewares/validateParams')
const { validateQuery } = require('../middlewares/validateQuery')
const {
  movementQuerySchema,
  createMovementSchema,
  createFeedTypeSchema,
  updateFeedTypeSchema,
  feedKeyParamSchema,
  createIngredientMovementSchema,
  createIngredientTypeSchema,
  updateIngredientTypeSchema,
  ingredientKeyParamSchema,
  ingredientMovementQuerySchema,
  productionPreviewSchema,
  saveRecipeSchema,
} = require('../validations/inventoryValidation')
const inventoryController = require('../controllers/inventoryController')

const router = express.Router()

router.use(requireAuth)

router.get('/feed', asyncHandler(inventoryController.feedOverview))
router.get('/feed/movements', validateQuery(movementQuerySchema), asyncHandler(inventoryController.feedMovements))
router.post(
  '/feed/movements',
  validateRequest(createMovementSchema),
  asyncHandler(inventoryController.createFeedMovement),
)
router.post(
  '/feed/production-preview',
  validateRequest(productionPreviewSchema),
  asyncHandler(inventoryController.feedProductionPreview),
)
router.get('/feed/types', asyncHandler(inventoryController.listFeedTypes))
router.post(
  '/feed/types',
  validateRequest(createFeedTypeSchema),
  asyncHandler(inventoryController.createFeedType),
)
router.patch(
  '/feed/types/:feedKey',
  validateParams(feedKeyParamSchema),
  validateRequest(updateFeedTypeSchema),
  asyncHandler(inventoryController.updateFeedType),
)

router.get('/ingredients', asyncHandler(inventoryController.ingredientOverview))
router.get(
  '/ingredients/movements',
  validateQuery(ingredientMovementQuerySchema),
  asyncHandler(inventoryController.ingredientMovements),
)
router.post(
  '/ingredients/movements',
  validateRequest(createIngredientMovementSchema),
  asyncHandler(inventoryController.createIngredientMovement),
)
router.post(
  '/ingredients/types',
  validateRequest(createIngredientTypeSchema),
  asyncHandler(inventoryController.createIngredientType),
)
router.patch(
  '/ingredients/types/:ingredientKey',
  validateParams(ingredientKeyParamSchema),
  validateRequest(updateIngredientTypeSchema),
  asyncHandler(inventoryController.updateIngredientType),
)

router.get('/recipes', asyncHandler(inventoryController.listRecipes))
router.get(
  '/recipes/:feedKey',
  validateParams(feedKeyParamSchema),
  asyncHandler(inventoryController.getRecipe),
)
router.put(
  '/recipes/:feedKey',
  validateParams(feedKeyParamSchema),
  validateRequest(saveRecipeSchema),
  asyncHandler(inventoryController.saveRecipe),
)

module.exports = router
