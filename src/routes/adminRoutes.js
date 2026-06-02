const express = require('express')
const { requireAuth, requireRole } = require('../middlewares/authMiddleware')
const adminUserRoutes = require('./adminUserRoutes')
const adminVaccinationCatalogRoutes = require('./adminVaccinationCatalogRoutes')

const router = express.Router()

router.use(requireAuth, requireRole('admin'))

router.get('/ping', (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Acceso admin correcto.',
  })
})

router.use('/users', adminUserRoutes)
router.use('/vaccination-catalog', adminVaccinationCatalogRoutes)

module.exports = router
