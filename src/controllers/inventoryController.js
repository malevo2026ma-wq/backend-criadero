const feedInventoryService = require('../services/feedInventoryService')
const feedCatalogService = require('../services/feedCatalogService')
const ingredientInventoryService = require('../services/ingredientInventoryService')
const ingredientCatalogService = require('../services/ingredientCatalogService')
const feedRecipeService = require('../services/feedRecipeService')
const feedProductionService = require('../services/feedProductionService')

async function feedOverview(_req, res) {
  const data = await feedInventoryService.getOverview()
  return res.status(200).json({ success: true, ...data })
}

async function feedMovements(req, res) {
  const data = await feedInventoryService.listMovements(req.query)
  return res.status(200).json({ success: true, ...data })
}

async function createFeedMovement(req, res) {
  const userId = req.user?.id ?? null
  const movement = await feedInventoryService.createManualMovement(req.body, userId)
  const overview = await feedInventoryService.getOverview()
  const ingredientOverview = await ingredientInventoryService.getOverview()
  return res.status(201).json({
    success: true,
    movement,
    ...overview,
    ingredientItems: ingredientOverview.items,
  })
}

async function feedProductionPreview(req, res) {
  const preview = await feedProductionService.previewProductionRequirements(
    req.body.feedKey,
    req.body.quantity,
  )
  return res.status(200).json({ success: true, preview })
}

async function listFeedTypes(req, res) {
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true'
  const feedTypes = await feedCatalogService.loadFeedTypes({ activeOnly: !includeInactive })
  return res.status(200).json({ success: true, feedTypes })
}

async function createFeedType(req, res) {
  const item = await feedCatalogService.createFeedType(req.body)
  feedCatalogService.invalidateCache()
  const overview = await feedInventoryService.getOverview()
  return res.status(201).json({ success: true, item, ...overview })
}

async function updateFeedType(req, res) {
  const item = await feedCatalogService.updateFeedType(req.params.feedKey, req.body)
  feedCatalogService.invalidateCache()
  const overview = await feedInventoryService.getOverview()
  return res.status(200).json({ success: true, item, ...overview })
}

async function ingredientOverview(_req, res) {
  const data = await ingredientInventoryService.getOverview()
  return res.status(200).json({ success: true, ...data })
}

async function ingredientMovements(req, res) {
  const data = await ingredientInventoryService.listMovements(req.query)
  return res.status(200).json({ success: true, ...data })
}

async function createIngredientMovement(req, res) {
  const userId = req.user?.id ?? null
  const movement = await ingredientInventoryService.createManualMovement(req.body, userId)
  const overview = await ingredientInventoryService.getOverview()
  return res.status(201).json({ success: true, movement, ...overview })
}

async function createIngredientType(req, res) {
  const item = await ingredientCatalogService.createIngredientType(req.body)
  const overview = await ingredientInventoryService.getOverview()
  return res.status(201).json({ success: true, item, ...overview })
}

async function updateIngredientType(req, res) {
  const item = await ingredientCatalogService.updateIngredientType(
    req.params.ingredientKey,
    req.body,
  )
  const overview = await ingredientInventoryService.getOverview()
  return res.status(200).json({ success: true, item, ...overview })
}

async function listRecipes(_req, res) {
  const recipes = await feedRecipeService.listRecipes()
  return res.status(200).json({ success: true, recipes })
}

async function getRecipe(req, res) {
  const recipe = await feedRecipeService.getRecipe(req.params.feedKey)
  return res.status(200).json({ success: true, recipe })
}

async function saveRecipe(req, res) {
  const recipe = await feedRecipeService.saveRecipe(req.params.feedKey, req.body)
  const overview = await feedInventoryService.getOverview()
  return res.status(200).json({ success: true, recipe, ...overview })
}

module.exports = {
  feedOverview,
  feedMovements,
  createFeedMovement,
  feedProductionPreview,
  listFeedTypes,
  createFeedType,
  updateFeedType,
  ingredientOverview,
  ingredientMovements,
  createIngredientMovement,
  createIngredientType,
  updateIngredientType,
  listRecipes,
  getRecipe,
  saveRecipe,
}
