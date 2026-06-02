const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { validateQuery } = require('../middlewares/validateQuery')
const { validateRequest } = require('../middlewares/validateRequest')
const { validateParams } = require('../middlewares/validateParams')
const {
  listUsersQuerySchema,
  createAdminUserSchema,
  updateAdminUserSchema,
  userIdParamSchema,
} = require('../validations/adminUserValidation')
const adminUserController = require('../controllers/adminUserController')

const router = express.Router()

router.get(
  '/',
  validateQuery(listUsersQuerySchema),
  asyncHandler(adminUserController.list),
)
router.post(
  '/',
  validateRequest(createAdminUserSchema),
  asyncHandler(adminUserController.create),
)
router.put(
  '/:userId',
  validateParams(userIdParamSchema),
  validateRequest(updateAdminUserSchema),
  asyncHandler(adminUserController.update),
)
router.delete(
  '/:userId',
  validateParams(userIdParamSchema),
  asyncHandler(adminUserController.remove),
)

module.exports = router
