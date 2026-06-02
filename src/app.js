const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const { env } = require('./config/env')
const routes = require('./routes')
const { notFoundHandler, errorHandler } = require('./middlewares/errorMiddleware')

const app = express()

if (env.isProduction) {
  app.set('trust proxy', 1)
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }
      const normalized = origin.replace(/\/+$/, '')
      if (env.frontendOrigins.includes(normalized)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  }),
)

app.use(morgan(env.isProduction ? 'combined' : 'dev'))
app.use(express.json({ limit: '1mb' }))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 400 : 200,
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 30 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Probá más tarde.' },
})

app.use(globalLimiter)
app.use('/api/auth', authLimiter)

app.use('/api', routes)
app.use(notFoundHandler)
app.use(errorHandler)

module.exports = { app }
