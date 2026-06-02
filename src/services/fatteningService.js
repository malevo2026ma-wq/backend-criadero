const { randomUUID } = require('crypto')
const { AppError } = require('../utils/AppError')
const { normalizeIsoDate } = require('../utils/dateUtils')
const { ESTABLISHMENT_NAME } = require('../constants/farmConstants')
const {
  STAGES,
  STAGE_LABELS,
  daysInMonth,
} = require('../constants/fatteningConstants')
const fatteningRepository = require('../models/fatteningRepository')
const reportsRepository = require('../models/reportsRepository')

const MOVEMENT_LABELS = {
  birth: 'Parto (nacidos vivos)',
  wean_out: 'Destete — salida maternidad',
  wean_in: 'Destete — ingreso recría',
  death: 'Muerte',
  transfer_out: 'Traspaso — salida',
  transfer_in: 'Traspaso — ingreso',
  manual: 'Ajuste manual',
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseQty(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function prevYearMonth(year, month) {
  if (month <= 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function dayFromIso(iso, year, month) {
  const d = normalizeIsoDate(iso)
  if (!d) return null
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(5, 7))
  if (y !== year || m !== month) return null
  return Number(d.slice(8, 10))
}

function emptyAutoByDay(dim) {
  const map = new Map()
  for (let day = 1; day <= dim; day += 1) {
    map.set(day, {
      maternidad: { ingreso: 0, salida: 0, births: [], weanOut: [] },
      recria: { ingreso: 0, salida: 0, weanIn: [] },
      desarrollo: { ingreso: 0, salida: 0 },
      terminacion: { ingreso: 0, salida: 0 },
    })
  }
  return map
}

async function buildAutoEvents(year, month) {
  const dim = daysInMonth(year, month)
  const byDay = emptyAutoByDay(dim)

  const [births, weanings] = await Promise.all([
    reportsRepository.listBirthCyclesRaw(),
    reportsRepository.listWeaningCyclesRaw(),
  ])

  for (const b of births) {
    const day = dayFromIso(b.date, year, month)
    if (!day) continue
    const qty = parseQty(b.bornAlive)
    if (qty <= 0) continue
    const slot = byDay.get(day).maternidad
    slot.ingreso += qty
    slot.births.push({
      sowNumber: b.sowNumber,
      qty,
      date: normalizeIsoDate(b.date),
    })
  }

  for (const w of weanings) {
    const day = dayFromIso(w.date, year, month)
    if (!day) continue
    const qty = parseQty(w.piglets)
    if (qty <= 0) continue
    const mat = byDay.get(day).maternidad
    const rec = byDay.get(day).recria
    mat.salida += qty
    mat.weanOut.push({ sowNumber: w.sowNumber, qty, date: normalizeIsoDate(w.date) })
    rec.ingreso += qty
    rec.weanIn.push({ sowNumber: w.sowNumber, qty, date: normalizeIsoDate(w.date) })
  }

  return byDay
}

function indexManualRows(rows) {
  const map = new Map()
  for (const r of rows) {
    map.set(`${r.dayOfMonth}:${r.stage}`, r)
  }
  return map
}

function buildStageCell(opening, auto, manual) {
  const ingreso = (auto?.ingreso || 0) + (manual?.manualIngreso || 0)
  const salida = (auto?.salida || 0) + (manual?.manualSalida || 0)
  const deaths = manual?.manualDeaths || 0
  const total = Math.max(0, opening + ingreso - deaths - salida)
  return {
    opening,
    autoIngreso: auto?.ingreso || 0,
    autoSalida: auto?.salida || 0,
    manualIngreso: manual?.manualIngreso || 0,
    manualDeaths: deaths,
    manualSalida: manual?.manualSalida || 0,
    ingreso,
    deaths,
    salida,
    total,
    autoDetails: {
      births: auto?.births ?? [],
      weanOut: auto?.weanOut ?? [],
      weanIn: auto?.weanIn ?? [],
    },
  }
}

/** Calcula cierre de un mes sin crear registro nuevo. */
async function computeClosingBalances(year, month) {
  const monthRow = await fatteningRepository.findMonthByYearMonth(year, month)
  if (!monthRow) {
    return { maternidad: 0, recria: 0, desarrollo: 0, terminacion: 0 }
  }
  const sheet = await buildSheetForMonthRow(monthRow, year, month)
  return sheet.closingBalances
}

/** Saldo día 1: cierre del mes anterior por etapa; si no hay mes previo, saldo inicial manual. */
async function resolveDay1Opening(year, month, monthRow) {
  const prev = prevYearMonth(year, month)
  const prevRow = await fatteningRepository.findMonthByYearMonth(prev.year, prev.month)
  if (prevRow) {
    return computeClosingBalances(prev.year, prev.month)
  }
  return { ...monthRow.opening }
}

async function buildSheetForMonthRow(monthRow, year, month) {
  const dim = daysInMonth(year, month)
  const [autoByDay, manualRows, day1Opening] = await Promise.all([
    buildAutoEvents(year, month),
    fatteningRepository.listDailyForMonth(monthRow.id),
    resolveDay1Opening(year, month, monthRow),
  ])
  const manualMap = indexManualRows(manualRows)

  const prevTotals = { ...day1Opening }
  const days = []
  const monthTotals = {
    maternidad: { ingreso: 0, deaths: 0, salida: 0 },
    recria: { ingreso: 0, deaths: 0, salida: 0 },
    desarrollo: { ingreso: 0, deaths: 0, salida: 0 },
    terminacion: { ingreso: 0, deaths: 0, salida: 0 },
  }

  for (let day = 1; day <= dim; day += 1) {
    const autoDay = autoByDay.get(day)
    const stages = {}
    for (const stage of STAGES) {
      const opening = day === 1 ? day1Opening[stage] : prevTotals[stage]
      const manual = manualMap.get(`${day}:${stage}`)
      const auto = autoDay[stage]
      stages[stage] = buildStageCell(opening, auto, manual)
      prevTotals[stage] = stages[stage].total
      monthTotals[stage].ingreso += stages[stage].ingreso
      monthTotals[stage].deaths += stages[stage].deaths
      monthTotals[stage].salida += stages[stage].salida
    }
    days.push({ day, stages })
  }

  const prev = prevYearMonth(year, month)
  const prevRow = await fatteningRepository.findMonthByYearMonth(prev.year, prev.month)

  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })

  return {
    establishment: ESTABLISHMENT_NAME,
    year,
    month,
    monthTitle: monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1),
    monthId: monthRow.id,
    daysInMonth: dim,
    openingBalances: day1Opening,
    openingSource: prevRow ? 'previous_month' : 'manual',
    closingBalances: {
      maternidad: prevTotals.maternidad,
      recria: prevTotals.recria,
      desarrollo: prevTotals.desarrollo,
      terminacion: prevTotals.terminacion,
    },
    days,
    monthTotals,
    stageLabels: STAGE_LABELS,
    stages: STAGES,
  }
}

async function getOrCreateMonth(year, month) {
  if (month < 1 || month > 12) throw new AppError('Mes inválido (1–12).', 400)
  if (year < 2000 || year > 2100) throw new AppError('Año inválido.', 400)

  let monthRow = await fatteningRepository.findMonthByYearMonth(year, month)
  if (!monthRow) {
    const id = randomUUID()
    await fatteningRepository.insertMonth({
      id,
      year,
      month,
      opening: { maternidad: 0, recria: 0, desarrollo: 0, terminacion: 0 },
      notes: null,
    })
    monthRow = await fatteningRepository.findMonthByYearMonth(year, month)
  }

  return buildSheetForMonthRow(monthRow, year, month)
}

function buildAutoMovementList(year, month, autoByDay) {
  const items = []
  const dim = daysInMonth(year, month)
  for (let day = 1; day <= dim; day += 1) {
    const autoDay = autoByDay.get(day)
    for (const birth of autoDay.maternidad.births) {
      items.push({
        id: `auto-birth-${day}-${birth.sowNumber}-${birth.date}`,
        dayOfMonth: day,
        stage: 'maternidad',
        movementType: 'birth',
        movementLabel: MOVEMENT_LABELS.birth,
        quantity: birth.qty,
        counterStage: null,
        sowNumber: birth.sowNumber,
        notes: `FRP ${birth.date}`,
        source: 'auto',
        createdAt: null,
      })
    }
    for (const w of autoDay.maternidad.weanOut) {
      items.push({
        id: `auto-wean-out-${day}-${w.sowNumber}`,
        dayOfMonth: day,
        stage: 'maternidad',
        movementType: 'wean_out',
        movementLabel: MOVEMENT_LABELS.wean_out,
        quantity: w.qty,
        counterStage: 'recria',
        sowNumber: w.sowNumber,
        notes: `Destete ${w.date}`,
        source: 'auto',
        createdAt: null,
      })
    }
    for (const w of autoDay.recria.weanIn) {
      items.push({
        id: `auto-wean-in-${day}-${w.sowNumber}`,
        dayOfMonth: day,
        stage: 'recria',
        movementType: 'wean_in',
        movementLabel: MOVEMENT_LABELS.wean_in,
        quantity: w.qty,
        counterStage: 'maternidad',
        sowNumber: w.sowNumber,
        notes: `Destete ${w.date}`,
        source: 'auto',
        createdAt: null,
      })
    }
  }
  return items
}

async function listMovements(year, month, filters = {}) {
  const sheet = await getOrCreateMonth(year, month)
  const dayFilter = filters.day ? Number(filters.day) : null
  const stageFilter = filters.stage || null

  const autoByDay = await buildAutoEvents(year, month)
  let items = buildAutoMovementList(year, month, autoByDay)

  let manualRows = []
  try {
    manualRows = await fatteningRepository.listMovementsForMonth(sheet.monthId, {
      day: dayFilter || undefined,
      stage: stageFilter || undefined,
    })
  } catch {
    manualRows = []
  }

  for (const m of manualRows) {
    items.push({
      id: m.id,
      dayOfMonth: m.dayOfMonth,
      stage: m.stage,
      movementType: m.movementType,
      movementLabel: MOVEMENT_LABELS[m.movementType] || m.movementType,
      quantity: m.quantity,
      counterStage: m.counterStage,
      sowNumber: m.sowNumber,
      notes: m.notes,
      source: m.source,
      createdAt: m.createdAt,
    })
  }

  if (dayFilter) items = items.filter((i) => i.dayOfMonth === dayFilter)
  if (stageFilter) items = items.filter((i) => i.stage === stageFilter)

  items.sort((a, b) => {
    if (a.dayOfMonth !== b.dayOfMonth) return a.dayOfMonth - b.dayOfMonth
    if (a.source !== b.source) return a.source === 'auto' ? -1 : 1
    return String(a.movementType).localeCompare(String(b.movementType))
  })

  return {
    year,
    month,
    monthTitle: sheet.monthTitle,
    total: items.length,
    items,
    stageLabels: STAGE_LABELS,
  }
}

async function updateOpeningBalances(year, month, opening, notes) {
  const sheet = await getOrCreateMonth(year, month)
  await fatteningRepository.updateMonthOpening(sheet.monthId, opening, notes)
  return getOrCreateMonth(year, month)
}

async function updateDayStage(year, month, day, stage, body) {
  const sheet = await getOrCreateMonth(year, month)
  if (day < 1 || day > sheet.daysInMonth) throw new AppError('Día inválido para este mes.', 400)
  if (!STAGES.includes(stage)) throw new AppError('Etapa inválida.', 400)

  await fatteningRepository.upsertDaily(sheet.monthId, day, stage, {
    manualIngreso: Math.max(0, parseQty(body.manualIngreso)),
    manualDeaths: Math.max(0, parseQty(body.manualDeaths)),
    manualSalida: Math.max(0, parseQty(body.manualSalida)),
    notes: body.notes ?? null,
  })
  return getOrCreateMonth(year, month)
}

async function registerTransfer(year, month, { day, fromStage, toStage, quantity }) {
  const sheet = await getOrCreateMonth(year, month)
  if (day < 1 || day > sheet.daysInMonth) throw new AppError('Día inválido para este mes.', 400)
  if (!STAGES.includes(fromStage) || !STAGES.includes(toStage)) {
    throw new AppError('Etapas inválidas.', 400)
  }
  if (fromStage === toStage) throw new AppError('Origen y destino deben ser distintos.', 400)
  if (fromStage === 'maternidad' && toStage === 'recria') {
    throw new AppError(
      'Maternidad → Recría se registra automáticamente al cargar el destete en la planilla de la cerda.',
      400,
    )
  }
  const qty = parseQty(quantity)
  if (qty <= 0) throw new AppError('La cantidad debe ser mayor a 0.', 400)

  await fatteningRepository.addManualDelta(sheet.monthId, day, fromStage, { manualSalida: qty })
  await fatteningRepository.addManualDelta(sheet.monthId, day, toStage, { manualIngreso: qty })

  try {
    await fatteningRepository.insertMovement({
      monthId: sheet.monthId,
      dayOfMonth: day,
      stage: fromStage,
      movementType: 'transfer_out',
      quantity: qty,
      counterStage: toStage,
      notes: `${STAGE_LABELS[fromStage]} → ${STAGE_LABELS[toStage]}`,
      source: 'manual',
    })
    await fatteningRepository.insertMovement({
      monthId: sheet.monthId,
      dayOfMonth: day,
      stage: toStage,
      movementType: 'transfer_in',
      quantity: qty,
      counterStage: fromStage,
      notes: `${STAGE_LABELS[fromStage]} → ${STAGE_LABELS[toStage]}`,
      source: 'manual',
    })
  } catch {
    /* tabla de movimientos opcional hasta migración */
  }

  return getOrCreateMonth(year, month)
}

async function registerDeaths(year, month, { day, stage, quantity, notes }) {
  const sheet = await getOrCreateMonth(year, month)
  if (day < 1 || day > sheet.daysInMonth) throw new AppError('Día inválido para este mes.', 400)
  if (!STAGES.includes(stage)) throw new AppError('Etapa inválida.', 400)
  const qty = parseQty(quantity)
  if (qty <= 0) throw new AppError('La cantidad debe ser mayor a 0.', 400)

  await fatteningRepository.addManualDelta(sheet.monthId, day, stage, { manualDeaths: qty })

  try {
    await fatteningRepository.insertMovement({
      monthId: sheet.monthId,
      dayOfMonth: day,
      stage,
      movementType: 'death',
      quantity: qty,
      notes: notes ?? null,
      source: 'manual',
    })
  } catch {
    /* tabla opcional */
  }

  return getOrCreateMonth(year, month)
}

/** Resumen del mes para cierre (sin crear planilla nueva). */
async function getMonthSummaryForClose(year, month) {
  const monthRow = await fatteningRepository.findMonthByYearMonth(year, month)
  if (!monthRow) return null
  const sheet = await buildSheetForMonthRow(monthRow, year, month)
  return {
    closingBalances: sheet.closingBalances,
    monthTotals: sheet.monthTotals,
    openingSource: sheet.openingSource,
  }
}

module.exports = {
  getOrCreateMonth,
  updateOpeningBalances,
  updateDayStage,
  registerTransfer,
  registerDeaths,
  listMovements,
  computeClosingBalances,
  getMonthSummaryForClose,
}
