const STAGES = ['maternidad', 'recria', 'desarrollo', 'terminacion']

const STAGE_LABELS = {
  maternidad: 'Maternidad',
  recria: 'Recría',
  desarrollo: 'Desarrollo',
  terminacion: 'Terminación',
}

const STAGE_ORDER = {
  maternidad: 0,
  recria: 1,
  desarrollo: 2,
  terminacion: 3,
}

/** Transiciones manuales permitidas (destete maternidad→recría es automático). */
const MANUAL_TRANSFER_PAIRS = [
  ['recria', 'desarrollo'],
  ['desarrollo', 'terminacion'],
  ['maternidad', 'recria'],
  ['recria', 'maternidad'],
  ['desarrollo', 'recria'],
  ['terminacion', 'desarrollo'],
]

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

module.exports = {
  STAGES,
  STAGE_LABELS,
  STAGE_ORDER,
  MANUAL_TRANSFER_PAIRS,
  daysInMonth,
}
