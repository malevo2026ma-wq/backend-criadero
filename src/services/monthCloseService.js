const { AppError } = require('../utils/AppError')
const { normalizeIsoDate, diffCalendarDays } = require('../utils/dateUtils')
const { ESTABLISHMENT_NAME } = require('../constants/farmConstants')
const {
  FEED_CLOSE_ROWS,
  SALES_CATEGORIES,
  DEFAULT_MANUAL,
} = require('../constants/monthCloseConstants')
const monthCloseRepository = require('../models/monthCloseRepository')
const reportsRepository = require('../models/reportsRepository')
const feedService = require('./feedService')
const feedCatalogService = require('./feedCatalogService')
const fatteningService = require('./fatteningService')

const GILT_MAX_AGE_DAYS = 240

function pad2(n) {
  return String(n).padStart(2, '0')
}

function monthBounds(year, month) {
  if (month < 1 || month > 12) throw new AppError('Mes inválido (1–12).', 400)
  if (year < 2000 || year > 2100) throw new AppError('Año inválido.', 400)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    lastDay,
  }
}

function parseNonNegativeInt(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function parseOptionalNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function isoInRange(iso, fromIso, toIso) {
  const d = normalizeIsoDate(iso)
  if (!d) return false
  return d >= fromIso && d <= toIso
}

function deepMergeManual(stored) {
  const base = JSON.parse(JSON.stringify(DEFAULT_MANUAL))
  if (!stored || typeof stored !== 'object') return base
  const merge = (target, src) => {
    if (!src || typeof src !== 'object') return
    for (const key of Object.keys(src)) {
      if (src[key] !== null && typeof src[key] === 'object' && !Array.isArray(src[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {}
        merge(target[key], src[key])
      } else {
        target[key] = src[key]
      }
    }
  }
  merge(base, stored)
  return base
}

function pickValue(manual, computed) {
  const m = parseOptionalNumber(manual)
  if (m !== null) return m
  return computed ?? 0
}

function pickSalesLine(manualLine, computed) {
  const heads = pickValue(manualLine?.heads, computed.heads)
  const kgTotal = pickValue(manualLine?.kgTotal, computed.kgTotal)
  const kgProm = heads > 0 ? Math.round((kgTotal / heads) * 100) / 100 : 0
  return { heads, kgTotal, kgProm, source: manualLine?.heads != null ? 'manual' : 'computed' }
}

function groupCyclesBySow(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.sow_id)) {
      map.set(row.sow_id, {
        sowId: row.sow_id,
        birthDate: row.birth_date ?? '',
        entryDate: row.entry_date ?? '',
        cycles: [],
      })
    }
    if (row.cycle_id) {
      map.get(row.sow_id).cycles.push({
        fs: row.fs ?? '',
        frp: row.frp ?? '',
        weanDate: row.wean_date ?? '',
        repeatEstrus: Boolean(row.repeat_estrus),
        deadLactation: row.dead_lactation ?? '',
      })
    }
  }
  return [...map.values()]
}

function hadPriorServiceBefore(cycles, fsIso) {
  for (const c of cycles) {
    const fs = normalizeIsoDate(c.fs)
    if (fs && fs < fsIso) return true
  }
  return false
}

function isGiltAtService(birthDate, fsIso) {
  const birth = normalizeIsoDate(birthDate)
  if (!birth) return false
  const age = diffCalendarDays(birth, fsIso)
  return age !== null && age >= 0 && age <= GILT_MAX_AGE_DAYS
}

function computeServices(cyclesBySow, from, to) {
  let cachorras = 0
  let adultas = 0
  for (const sow of cyclesBySow) {
    for (const c of sow.cycles) {
      const fs = normalizeIsoDate(c.fs)
      if (!fs || !isoInRange(fs, from, to)) continue
      const gilt =
        !hadPriorServiceBefore(sow.cycles, fs) || isGiltAtService(sow.birthDate, fs)
      if (gilt) cachorras += 1
      else adultas += 1
    }
  }
  return { cachorras, adultas, total: cachorras + adultas }
}

function sowStateAtDate(sow, endIso) {
  let active = null
  let activeFs = ''
  for (const c of sow.cycles) {
    const fs = normalizeIsoDate(c.fs)
    if (!fs || fs > endIso) continue
    if (!active || fs > activeFs) {
      active = c
      activeFs = fs
    }
  }
  if (!active) {
    const everServed = sow.cycles.some((c) => {
      const fs = normalizeIsoDate(c.fs)
      return fs && fs <= endIso
    })
    if (!everServed) return 'cacho_serviv'
    return 'vacia'
  }
  const frp = normalizeIsoDate(active.frp)
  const wean = normalizeIsoDate(active.weanDate)
  if (frp && frp <= endIso && (!wean || wean > endIso)) return 'parida'
  if (!frp || frp > endIso) return 'gestante'
  return 'vacia'
}

function computeInventoryRepro(cyclesBySow, endIso) {
  const counts = {
    cachoServiv: 0,
    vacias: 0,
    gestantes: 0,
    paridas: 0,
    descarte: 0,
    machos: 0,
  }
  for (const sow of cyclesBySow) {
    const st = sowStateAtDate(sow, endIso)
    if (st === 'cacho_serviv') counts.cachoServiv += 1
    else if (st === 'vacia') counts.vacias += 1
    else if (st === 'gestante') counts.gestantes += 1
    else if (st === 'parida') counts.paridas += 1
  }
  counts.totalHembProductiva =
    counts.cachoServiv + counts.vacias + counts.gestantes + counts.paridas
  counts.totalReproductor = counts.totalHembProductiva + counts.machos + counts.descarte
  return counts
}

function mapFatteningClosingToInventory(closing) {
  const lechones = closing?.maternidad ?? 0
  const recria = closing?.recria ?? 0
  const crecimiento = closing?.desarrollo ?? 0
  const terminacion = closing?.terminacion ?? 0
  return {
    lechones,
    recria,
    crecimiento,
    terminacion,
    total: lechones + recria + crecimiento + terminacion,
  }
}

async function computeInventoryFattening(year, month) {
  const summary = await fatteningService.getMonthSummaryForClose(year, month)
  if (!summary) {
    return { ...mapFatteningClosingToInventory(null), hasSheet: false }
  }
  return { ...mapFatteningClosingToInventory(summary.closingBalances), hasSheet: true }
}

async function computeProductionMetrics(from, to, year, month) {
  const [allBirths, allWeanings, cycleRows, fatSummary] = await Promise.all([
    reportsRepository.listBirthCyclesRaw(),
    reportsRepository.listWeaningCyclesRaw(),
    monthCloseRepository.listAllCyclesWithSows(),
    fatteningService.getMonthSummaryForClose(year, month),
  ])

  const births = allBirths.filter((r) => isoInRange(r.date, from, to))
  const weanings = allWeanings.filter((r) => isoInRange(r.date, from, to))

  let partos = births.length
  let vivos = 0
  let muertos = 0
  let totalNac = 0
  for (const b of births) {
    vivos += parseNonNegativeInt(b.bornAlive)
    muertos += parseNonNegativeInt(b.bornDead) + parseNonNegativeInt(b.bornMummified)
    totalNac += parseNonNegativeInt(b.bornTotal)
  }

  let hembresDestete = weanings.length
  let lechonesDestete = 0
  for (const w of weanings) {
    lechonesDestete += parseNonNegativeInt(w.piglets)
  }

  let rr = 0
  let lechonesMort = 0
  for (const row of cycleRows) {
    if (row.cycle_id && row.repeat_estrus && row.fs && isoInRange(row.fs, from, to)) {
      rr += 1
    }
    if (row.cycle_id && row.frp && isoInRange(row.frp, from, to)) {
      lechonesMort += parseNonNegativeInt(row.dead_lactation)
    }
  }

  const cyclesBySow = groupCyclesBySow(cycleRows)
  const services = computeServices(cyclesBySow, from, to)

  return {
    services,
    failures: { rr, ri: 0, ab: 0, mt: 0 },
    maternity: { partos, vivos, muertos, total: totalNac || vivos + muertos },
    weaning: { hembres: hembresDestete, lechones: lechonesDestete },
    mortality: {
      lechones: lechonesMort,
      recria: fatSummary?.monthTotals?.recria?.deaths ?? 0,
      desarrollo: fatSummary?.monthTotals?.desarrollo?.deaths ?? 0,
      terminacion: fatSummary?.monthTotals?.terminacion?.deaths ?? 0,
      reprod: 0,
    },
    purchases: { hembras: 0, machos: 0 },
  }
}

async function computeFeed(year, month) {
  await feedCatalogService.ensureCatalogReady()
  const feedTypes = await feedCatalogService.loadFeedTypes({ activeOnly: true })

  let catalogTotals = {}
  let hasFeedSheet = false
  try {
    const sheet = await feedService.getOrCreateMonth(year, month, { createIfMissing: false })
    catalogTotals = sheet.grid?.columnTotals ?? {}
    hasFeedSheet = true
  } catch (e) {
    if (e.statusCode !== 404) throw e
  }

  const rowByKey = new Map()
  for (const f of feedTypes) {
    const fromSheet = hasFeedSheet && Object.prototype.hasOwnProperty.call(catalogTotals, f.key)
    const qty = fromSheet ? Number(catalogTotals[f.key]) || 0 : 0
    rowByKey.set(f.key, {
      key: f.key,
      label: f.label,
      catalogKey: f.key,
      quantity: qty,
      source: fromSheet ? 'alimentacion' : 'manual',
    })
  }

  for (const def of FEED_CLOSE_ROWS) {
    if (rowByKey.has(def.key)) continue
    const fromSheet = hasFeedSheet && def.catalogKey && catalogTotals[def.catalogKey] != null
    const qty = fromSheet ? Number(catalogTotals[def.catalogKey]) || 0 : 0
    rowByKey.set(def.key, {
      key: def.key,
      label: def.label,
      catalogKey: def.catalogKey,
      quantity: qty,
      source: fromSheet ? 'alimentacion' : 'manual',
    })
  }

  const rows = [...rowByKey.values()]
  const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  return { rows, total, hasFeedSheet }
}

function mergeSection(manual, computed, keys) {
  const out = {}
  for (const k of keys) {
    out[k] = pickValue(manual?.[k], computed?.[k])
  }
  return out
}

async function getMonthClose(year, month) {
  const { from, to } = monthBounds(year, month)
  const cycleRows = await monthCloseRepository.listAllCyclesWithSows()
  const cyclesBySow = groupCyclesBySow(cycleRows)

  const [production, feed, stored, inventoryFattening] = await Promise.all([
    computeProductionMetrics(from, to, year, month),
    computeFeed(year, month),
    monthCloseRepository.findByYearMonth(year, month),
    computeInventoryFattening(year, month),
  ])

  const inventoryRepro = computeInventoryRepro(cyclesBySow, to)
  const fatteningBase = {
    lechones: inventoryFattening.lechones,
    recria: inventoryFattening.recria,
    crecimiento: inventoryFattening.crecimiento,
    terminacion: inventoryFattening.terminacion,
    total: inventoryFattening.total,
  }

  const manual = deepMergeManual(stored?.manualData)
  const computed = {
    production,
    inventoryRepro,
    inventoryFattening,
    feed,
    period: { from, to, year, month },
  }

  const merged = {
    services: {
      ...mergeSection(manual.services, production.services, ['cachorras', 'adultas']),
      total:
        pickValue(manual.services?.cachorras, production.services.cachorras) +
        pickValue(manual.services?.adultas, production.services.adultas),
    },
    failures: mergeSection(manual.failures, production.failures, ['rr', 'ri', 'ab', 'mt']),
    maternity: mergeSection(manual.maternity, production.maternity, [
      'partos',
      'vivos',
      'muertos',
      'total',
    ]),
    weaning: mergeSection(manual.weaning, production.weaning, ['hembres', 'lechones']),
    mortality: mergeSection(manual.mortality, production.mortality, [
      'lechones',
      'recria',
      'desarrollo',
      'terminacion',
      'reprod',
    ]),
    purchases: mergeSection(manual.purchases, production.purchases, ['hembras', 'machos']),
    inventoryRepro: (() => {
      const cachoServiv = pickValue(
        manual.inventoryRepro?.cachoServiv,
        inventoryRepro.cachoServiv,
      )
      const vacias = pickValue(manual.inventoryRepro?.vacias, inventoryRepro.vacias)
      const gestantes = pickValue(manual.inventoryRepro?.gestantes, inventoryRepro.gestantes)
      const paridas = pickValue(manual.inventoryRepro?.paridas, inventoryRepro.paridas)
      const descarte = pickValue(manual.inventoryRepro?.descarte, inventoryRepro.descarte)
      const machos = pickValue(manual.inventoryRepro?.machos, inventoryRepro.machos)
      const totalHemb =
        parseOptionalNumber(manual.inventoryRepro?.totalHembProductiva) ??
        cachoServiv + vacias + gestantes + paridas
      const totalRep =
        parseOptionalNumber(manual.inventoryRepro?.totalReproductor) ??
        totalHemb + descarte + machos
      return {
        cachoServiv,
        vacias,
        gestantes,
        paridas,
        descarte,
        machos,
        totalHembProductiva: totalHemb,
        totalReproductor: totalRep,
      }
    })(),
    inventoryFattening: (() => {
      const lechones = pickValue(manual.inventoryFattening?.lechones, fatteningBase.lechones)
      const recria = pickValue(manual.inventoryFattening?.recria, fatteningBase.recria)
      const crecimiento = pickValue(
        manual.inventoryFattening?.crecimiento,
        fatteningBase.crecimiento,
      )
      const terminacion = pickValue(
        manual.inventoryFattening?.terminacion,
        fatteningBase.terminacion,
      )
      return {
        lechones,
        recria,
        crecimiento,
        terminacion,
        total: lechones + recria + crecimiento + terminacion,
      }
    })(),
    feed: {
      rows: feed.rows.map((row) => ({
        ...row,
        quantity: pickValue(manual.feed?.[row.key], row.quantity),
        manual: manual.feed?.[row.key] != null,
        auto: row.source === 'alimentacion',
      })),
      total: 0,
    },
    sales: Object.fromEntries(
      SALES_CATEGORIES.map((cat) => [
        cat.key,
        pickSalesLine(manual.sales?.[cat.key], { heads: 0, kgTotal: 0 }),
      ]),
    ),
  }
  merged.feed.total = merged.feed.rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)

  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })

  return {
    establishment: ESTABLISHMENT_NAME,
    year,
    month,
    monthTitle: monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1),
    producer: stored?.producer ?? '',
    closeDate: stored?.closeDate || to,
    period: { from, to },
    manual,
    computed: {
      ...computed,
      sources: {
        services: 'Ciclos productivos (F/S del mes)',
        maternity: 'Partos (F/R.P) del mes',
        weaning: 'Destetes del mes',
        failuresRr: 'Repite celo en servicios del mes',
        mortalityLechones: 'Muertos lactancia (M/L) en partos del mes',
        mortalityFattening: inventoryFattening.hasSheet
          ? 'Muertes registradas en plantel de engorde'
          : 'Manual (sin planilla de engorde)',
        inventoryRepro: `Existencia al ${to} según ciclos de cerdas`,
        feed: feed.hasFeedSheet
          ? 'Totales de la planilla de alimentación'
          : 'Manual (sin planilla este mes)',
        sales: 'Manual',
        purchases: 'Manual',
        inventoryFattening: inventoryFattening.hasSheet
          ? `Cierre del plantel de engorde al ${to}`
          : 'Manual (sin planilla de engorde este mes)',
        failuresOther: 'Manual (RI, AB, MT)',
      },
    },
    merged,
    savedAt: stored?.updatedAt ?? null,
    feedRowDefs: FEED_CLOSE_ROWS,
    salesCategories: SALES_CATEGORIES,
    integration: {
      feedSheet: Boolean(feed.hasFeedSheet),
      fatteningSheet: Boolean(inventoryFattening.hasSheet),
      sowCount: cyclesBySow.length,
      savedAt: stored?.updatedAt ?? null,
    },
  }
}

async function saveMonthClose(year, month, { producer, closeDate, manualData }, userId) {
  monthBounds(year, month)
  const manual = deepMergeManual(manualData)
  const row = await monthCloseRepository.upsert({
    year,
    month,
    producer: producer ?? '',
    closeDate: closeDate ?? '',
    manualData: manual,
    userId,
  })
  const full = await getMonthClose(year, month)
  return { saved: true, record: row, close: full }
}

module.exports = {
  getMonthClose,
  saveMonthClose,
  monthBounds,
}
