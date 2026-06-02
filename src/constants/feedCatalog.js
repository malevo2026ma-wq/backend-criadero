/**
 * Tipos de alimento de la planilla mensual (columnas).
 * Claves estables para API y base de datos.
 */

/** @typedef {{ key: string, label: string, shortLabel: string, sortOrder: number }} FeedTypeItem */

/** @type {FeedTypeItem[]} */
const FEED_TYPES = [
  { key: 'fase_1', label: 'Fase 1', shortLabel: 'Fase 1', sortOrder: 10 },
  { key: 'fase_2', label: 'Fase 2', shortLabel: 'Fase 2', sortOrder: 20 },
  { key: 'fase_3', label: 'Fase 3', shortLabel: 'Fase 3', sortOrder: 30 },
  { key: 'fase_4', label: 'Fase 4', shortLabel: 'Fase 4', sortOrder: 40 },
  { key: 'crecimiento', label: 'Crecimiento', shortLabel: 'Crecim.', sortOrder: 50 },
  { key: 'terminacion', label: 'Terminación', shortLabel: 'Termin.', sortOrder: 60 },
  { key: 'gestacion', label: 'Gestación', shortLabel: 'Gestac.', sortOrder: 70 },
  { key: 'lactancia', label: 'Lactancia', shortLabel: 'Lactanc.', sortOrder: 80 },
  { key: 'cachorras', label: 'Cachorras', shortLabel: 'Cachorr.', sortOrder: 90 },
]

const FEED_KEYS = new Set(FEED_TYPES.map((f) => f.key))

function isValidFeedKey(key) {
  return FEED_KEYS.has(String(key || '').trim())
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

module.exports = {
  FEED_TYPES,
  FEED_KEYS,
  isValidFeedKey,
  daysInMonth,
}
