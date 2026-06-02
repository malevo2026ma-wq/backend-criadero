const express = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { validateRequest } = require('../middlewares/validateRequest')
const { requireAuth } = require('../middlewares/authMiddleware')
const { env } = require('../config/env')
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('../validations/authValidation')
const authController = require('../controllers/authController')

const router = express.Router()

if (env.allowPublicRegister) {
  router.post(
    '/register',
    validateRequest(registerSchema),
    asyncHandler(authController.register),
  )
}

router.post('/login', validateRequest(loginSchema), asyncHandler(authController.login))
router.post(
  '/refresh',
  validateRequest(refreshSchema),
  asyncHandler(authController.refresh),
)
router.post('/logout', requireAuth, asyncHandler(authController.logout))
router.get('/me', requireAuth, asyncHandler(authController.me))

module.exports = router
