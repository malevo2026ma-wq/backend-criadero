const { randomUUID } = require('crypto')
const vaccinationCatalogRepository = require('../models/vaccinationCatalogRepository')
const { AppError } = require('../utils/AppError')
const vaccinationService = require('./vaccinationService')

function assertKeyFormat(vaccineKey) {
  const k = String(vaccineKey || '').trim()
  if (!/^[a-z0-9_]{1,64}$/i.test(k)) {
    throw new AppError(
      'Clave inválida: use solo letras, números y guión bajo, hasta 64 caracteres.',
      400,
    )
  }
  return k
}

async function listAll() {
  return vaccinationCatalogRepository.listAll(null, { activeOnly: false })
}

async function getByKey(vaccineKey) {
  const row = await vaccinationCatalogRepository.findByKey(null, assertKeyFormat(vaccineKey))
  if (!row) throw new AppError('Vacuna no encontrada en el catálogo.', 404)
  return row
}

async function create(body) {
  const vaccineKey = assertKeyFormat(body.vaccineKey ?? body.key)
  const existing = await vaccinationCatalogRepository.findByKey(null, vaccineKey)
  if (existing) throw new AppError('Ya existe una vacuna con esa clave.', 409)

  const category = String(body.category || '').trim()
  if (!['gestacion', 'maternidad_hembra', 'maternidad_lechon'].includes(category)) {
    throw new AppError('Categoría inválida.', 400)
  }
  const anchor = body.anchor === 'frp' ? 'frp' : 'fs'
  const sortOrder = Number(body.sortOrder)
  if (!Number.isFinite(sortOrder) || sortOrder < 0) {
    throw new AppError('sortOrder debe ser un número entero ≥ 0.', 400)
  }
  const dayOffset = Number(body.dayOffset)
  if (!Number.isFinite(dayOffset)) {
    throw new AppError('dayOffset inválido.', 400)
  }
  let windowEndOffset = null
  if (body.windowEndOffset !== undefined && body.windowEndOffset !== null && body.windowEndOffset !== '') {
    windowEndOffset = Number(body.windowEndOffset)
    if (!Number.isFinite(windowEndOffset)) {
      throw new AppError('windowEndOffset inválido.', 400)
    }
  }

  await vaccinationCatalogRepository.insertRow(null, {
    id: randomUUID(),
    vaccineKey,
    category,
    sortOrder,
    label: String(body.label || '').trim() || vaccineKey,
    doseText: body.doseText != null ? String(body.doseText) : '',
    isOptional: Boolean(body.isOptional),
    anchor,
    dayOffset,
    windowEndOffset,
    active: body.active !== false,
  })

  await vaccinationService.rebuildAllSowVaccinations()
  return vaccinationCatalogRepository.findByKey(null, vaccineKey)
}

async function update(vaccineKey, body) {
  const key = assertKeyFormat(vaccineKey)
  const current = await vaccinationCatalogRepository.findByKey(null, key)
  if (!current) throw new AppError('Vacuna no encontrada en el catálogo.', 404)

  const fields = {}
  if (body.category !== undefined) {
    const c = String(body.category || '').trim()
    if (!['gestacion', 'maternidad_hembra', 'maternidad_lechon'].includes(c)) {
      throw new AppError('Categoría inválida.', 400)
    }
    fields.category = c
  }
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder)
    if (!Number.isFinite(n) || n < 0) throw new AppError('sortOrder inválido.', 400)
    fields.sortOrder = n
  }
  if (body.label !== undefined) fields.label = String(body.label || '').trim() || current.label
  if (body.doseText !== undefined) fields.doseText = body.doseText != null ? String(body.doseText) : ''
  if (body.isOptional !== undefined) fields.isOptional = Boolean(body.isOptional)
  if (body.anchor !== undefined) fields.anchor = body.anchor === 'frp' ? 'frp' : 'fs'
  if (body.dayOffset !== undefined) {
    const n = Number(body.dayOffset)
    if (!Number.isFinite(n)) throw new AppError('dayOffset inválido.', 400)
    fields.dayOffset = n
  }
  if (body.windowEndOffset !== undefined) {
    if (body.windowEndOffset === null || body.windowEndOffset === '') fields.windowEndOffset = null
    else {
      const n = Number(body.windowEndOffset)
      if (!Number.isFinite(n)) throw new AppError('windowEndOffset inválido.', 400)
      fields.windowEndOffset = n
    }
  }
  if (body.active !== undefined) fields.active = Boolean(body.active)

  await vaccinationCatalogRepository.updateByKey(null, key, fields)
  await vaccinationService.rebuildAllSowVaccinations()
  return vaccinationCatalogRepository.findByKey(null, key)
}

async function deactivate(vaccineKey) {
  const key = assertKeyFormat(vaccineKey)
  const ok = await vaccinationCatalogRepository.updateByKey(null, key, { active: false })
  if (!ok) throw new AppError('Vacuna no encontrada en el catálogo.', 404)
  await vaccinationService.rebuildAllSowVaccinations()
  return vaccinationCatalogRepository.findByKey(null, key)
}

module.exports = {
  listAll,
  getByKey,
  create,
  update,
  deactivate,
}
