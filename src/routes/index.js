const express = require('express')
const { pingDatabase } = require('../config/db')
const authRoutes = require('./authRoutes')
const sowRoutes = require('./sowRoutes')
const adminRoutes = require('./adminRoutes')
const vaccinationRoutes = require('./vaccinationRoutes')
const feedRoutes = require('./feedRoutes')
const inventoryRoutes = require('./inventoryRoutes')
const reproductionRoutes = require('./reproductionRoutes')
const reportsRoutes = require('./reportsRoutes')
const monthCloseRoutes = require('./monthCloseRoutes')
const fatteningRoutes = require('./fatteningRoutes')

const router = express.Router()

router.get('/health', async (_req, res) => {
  try {
    await pingDatabase()
    return res.status(200).json({
      success: true,
      message: 'Backend funcionando correctamente.',
      db: 'ok',
    })
  } catch {
    return res.status(503).json({
      success: false,
      message: 'Backend activo pero la base de datos no responde.',
      db: 'error',
    })
  }
})

router.use('/auth', authRoutes)
router.use('/sows', sowRoutes)
router.use('/vaccinations', vaccinationRoutes)
router.use('/feed', feedRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/reproduction', reproductionRoutes)
router.use('/reports', reportsRoutes)
router.use('/month-close', monthCloseRoutes)
router.use('/fattening', fatteningRoutes)
router.use('/admin', adminRoutes)

module.exports = router
