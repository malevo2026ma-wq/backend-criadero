/** Filas de alimento en planilla de cierre (clave interna → catálogo feed si existe). */
const FEED_CLOSE_ROWS = [
  { key: 'fase_0', label: 'Fase 0', catalogKey: null },
  { key: 'fase_1', label: 'Fase 1', catalogKey: 'fase_1' },
  { key: 'fase_2', label: 'Fase 2', catalogKey: 'fase_2' },
  { key: 'fase_3', label: 'Fase 3', catalogKey: 'fase_3' },
  { key: 'fase_4', label: 'Fase 4', catalogKey: 'fase_4' },
  { key: 'desarrollo_1', label: 'Desarrollo 1', catalogKey: 'crecimiento' },
  { key: 'desarrollo_2', label: 'Desarrollo 2', catalogKey: null },
  { key: 'terminacion_1', label: 'Terminación 1', catalogKey: 'terminacion' },
  { key: 'terminacion_2', label: 'Terminación 2', catalogKey: null },
  { key: 'gestacion', label: 'Gestación', catalogKey: 'gestacion' },
  { key: 'lactancia', label: 'Lactancia', catalogKey: 'lactancia' },
  { key: 'cachorras_prep', label: 'Cachorras preparación', catalogKey: 'cachorras' },
  { key: 'preparto', label: 'Preparto', catalogKey: null },
  { key: 'padrillo', label: 'Padrillo', catalogKey: null },
]

const SALES_CATEGORIES = [
  { key: 'lechones', label: 'Lechones' },
  { key: 'cachorros', label: 'Cachorros' },
  { key: 'capones', label: 'Capones' },
  { key: 'pork', label: 'Pork' },
  { key: 'descarte', label: 'Descarte' },
]

const DEFAULT_MANUAL = {
  services: { cachorras: null, adultas: null },
  failures: { rr: null, ri: null, ab: null, mt: null },
  mortality: { lechones: null, recria: null, desarrollo: null, terminacion: null, reprod: null },
  purchases: { hembras: null, machos: null },
  inventoryRepro: {
    cachoServiv: null,
    vacias: null,
    gestantes: null,
    paridas: null,
    descarte: null,
    machos: null,
  },
  inventoryFattening: { lechones: null, recria: null, crecimiento: null, terminacion: null },
  feed: {},
  sales: {
    lechones: { heads: null, kgTotal: null },
    cachorros: { heads: null, kgTotal: null },
    capones: { heads: null, kgTotal: null },
    pork: { heads: null, kgTotal: null },
    descarte: { heads: null, kgTotal: null },
  },
}

module.exports = {
  FEED_CLOSE_ROWS,
  SALES_CATEGORIES,
  DEFAULT_MANUAL,
}
