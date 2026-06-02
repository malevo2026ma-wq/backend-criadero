const sowRepository = require('../models/sowRepository')
const reproductionRepository = require('../models/reproductionRepository')
const {
  isLactatingFromRow,
  isPregnantFromRow,
  expectedFppIso,
  isNearPartoFromRow,
  getOperationalPhase,
  getRodeoStatus,
  PHASE_LABELS,
  STATUS_LABELS,
} = require('../utils/reproductionPhase')
const { todayIsoLocal, diffCalendarDays, normalizeIsoDate } = require('../utils/dateUtils')

function enrichRodeoRow(row, todayIso) {
  const status = getRodeoStatus(row, todayIso)
  const phase = getOperationalPhase(row)
  const fpp = expectedFppIso(row)
  let daysToFpp = null
  if (fpp) {
    daysToFpp = diffCalendarDays(todayIso, fpp)
  }
  let daysInLactation = null
  if (isLactatingFromRow(row) && row.lastFrp) {
    const frp = normalizeIsoDate(row.lastFrp)
    if (frp) daysInLactation = diffCalendarDays(frp, todayIso)
  }

  return {
    ...row,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    phase,
    phaseLabel: PHASE_LABELS[phase] || phase,
    expectedFpp: fpp,
    daysToFpp,
    daysInLactation,
    isPregnant: isPregnantFromRow(row),
    isLactating: isLactatingFromRow(row),
    isNearParto: isNearPartoFromRow(row, todayIso),
  }
}

async function getOverview() {
  const todayIso = todayIsoLocal()
  const [dashboardRows, metrics, farrowingsByMonth] = await Promise.all([
    sowRepository.listSowsDashboardRows(),
    reproductionRepository.getHerdMetrics(),
    reproductionRepository.getFarrowingsByMonth(),
  ])

  let total = 0
  let prenadas = 0
  let amamantando = 0
  let cercaParto = 0
  const phaseCounts = {
    no_service: 0,
    need_fs: 0,
    parto: 0,
    nacidos: 0,
    destete_fecha: 0,
    destete_detalle: 0,
    cycle_complete: 0,
  }
  const statusCounts = {
    pregnant: 0,
    near_parto: 0,
    lactating: 0,
    pending: 0,
    ready: 0,
    inactive: 0,
  }

  const rodeoRows = await reproductionRepository.listSowsRodeoRows()
  for (const row of rodeoRows) {
    total += 1
    const enriched = enrichRodeoRow(row, todayIso)
    phaseCounts[enriched.phase] = (phaseCounts[enriched.phase] || 0) + 1
    statusCounts[enriched.status] = (statusCounts[enriched.status] || 0) + 1
    if (enriched.isLactating) amamantando += 1
    else if (enriched.isPregnant) {
      prenadas += 1
      if (enriched.isNearParto) cercaParto += 1
    }
  }

  const pendingTotal =
    (phaseCounts.need_fs || 0) +
    (phaseCounts.parto || 0) +
    (phaseCounts.nacidos || 0) +
    (phaseCounts.destete_fecha || 0) +
    (phaseCounts.destete_detalle || 0) +
    (statusCounts.inactive || 0)

  return {
    stats: { total, prenadas, amamantando, cercaParto, pendingTotal },
    phaseCounts,
    statusCounts,
    metrics,
    farrowingsByMonth,
  }
}

async function listRodeo({ status, phase, q } = {}) {
  const todayIso = todayIsoLocal()
  let rows = (await reproductionRepository.listSowsRodeoRows()).map((r) =>
    enrichRodeoRow(r, todayIso),
  )

  if (status && status !== 'all') {
    rows = rows.filter((r) => r.status === status)
  }
  if (phase && phase !== 'all') {
    rows = rows.filter((r) => r.phase === phase)
  }
  if (q && String(q).trim()) {
    const needle = String(q).trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.number.toLowerCase().includes(needle) ||
        (r.breed && r.breed.toLowerCase().includes(needle)) ||
        (r.lastMaleNo && r.lastMaleNo.toLowerCase().includes(needle)),
    )
  }

  return { items: rows, total: rows.length }
}

async function getCalendar({ days = 45 } = {}) {
  const horizon = Math.min(Math.max(Number(days) || 45, 7), 120)
  const todayIso = todayIsoLocal()
  const rows = await reproductionRepository.listSowsRodeoRows()
  const events = []

  for (const row of rows) {
    const enriched = enrichRodeoRow(row, todayIso)
    const label = `Chancha ${row.number}`

    if (enriched.expectedFpp && enriched.isPregnant) {
      const delta = enriched.daysToFpp
      if (delta !== null && delta >= -7 && delta <= horizon) {
        events.push({
          id: `${row.id}-fpp`,
          sowId: row.id,
          sowNumber: row.number,
          type: delta < 0 ? 'fpp_overdue' : delta <= 3 ? 'fpp_soon' : 'fpp_expected',
          date: enriched.expectedFpp,
          title: label,
          subtitle:
            delta < 0
              ? `F/P.P vencida (${Math.abs(delta)} días)`
              : delta === 0
                ? 'F/P.P hoy'
                : `F/P.P en ${delta} días`,
          sortKey: enriched.expectedFpp,
        })
      }
    }

    if (enriched.phase === 'parto' && enriched.lastFs) {
      events.push({
        id: `${row.id}-parto-pending`,
        sowId: row.id,
        sowNumber: row.number,
        type: 'parto_pending',
        date: todayIso,
        title: label,
        subtitle: 'Parto pendiente de registro',
        sortKey: todayIso,
      })
    }

    if (enriched.isLactating && row.lastFrp) {
      const frp = normalizeIsoDate(row.lastFrp)
      if (frp) {
        events.push({
          id: `${row.id}-lact`,
          sowId: row.id,
          sowNumber: row.number,
          type: 'lactation',
          date: frp,
          title: label,
          subtitle: `Lactando · ${enriched.daysInLactation ?? '?'} días · destete pendiente`,
          sortKey: frp,
        })
      }
    }

    if (['need_fs', 'nacidos', 'destete_fecha', 'destete_detalle'].includes(enriched.phase)) {
      events.push({
        id: `${row.id}-${enriched.phase}`,
        sowId: row.id,
        sowNumber: row.number,
        type: 'action_pending',
        date: todayIso,
        title: label,
        subtitle: enriched.phaseLabel,
        sortKey: todayIso,
      })
    }
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return String(a.date).localeCompare(String(b.date))
    return a.sowNumber.localeCompare(b.sowNumber)
  })

  return { events, horizonDays: horizon, today: todayIso }
}

module.exports = {
  getOverview,
  listRodeo,
  getCalendar,
}
