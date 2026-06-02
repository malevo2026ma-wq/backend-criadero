const { randomUUID } = require('crypto')
const { pool } = require('../config/db')
const { AppError } = require('../utils/AppError')
const sowRepository = require('../models/sowRepository')
const sowDonationRepository = require('../models/sowDonationRepository')
const {
  effectiveLactationCount,
  isCycleOpenForDonation,
  attachDonationSummariesToCycles,
} = require('../utils/pigletDonation')
const { todayIsoLocal, normalizeIsoDate } = require('../utils/dateUtils')

async function enrichSowWithDonations(sow, conn = null) {
  const cycleIds = (sow.cycles ?? []).map((c) => c.id).filter(Boolean)
  const donations = await sowDonationRepository.listDonationsForCycleIds(cycleIds, conn)
  return {
    ...sow,
    cycles: attachDonationSummariesToCycles(sow.cycles, donations),
  }
}

async function getCycleWithSow(cycleId, conn = null) {
  const owners = await sowRepository.findCycleOwners(conn, [cycleId].filter(Boolean))
  const sowId = owners.get(cycleId)
  if (!sowId) throw new AppError('Ciclo no encontrado.', 404)
  const sow = await sowRepository.getSowWithCycles(sowId, conn)
  const cycle = sow.cycles.find((c) => c.id === cycleId)
  if (!cycle) throw new AppError('Ciclo no encontrado.', 404)
  return { sow, cycle, sowId }
}

async function assertCycleReadyForDonation(cycle, label, donatedOut = 0, donatedIn = 0) {
  if (!isCycleOpenForDonation(cycle, donatedOut, donatedIn)) {
    throw new AppError(
      `${label}: la cerda debe tener parto y nacidos vivos, y el destete aún no cerrado (o faltan lechones por justificar).`,
      400,
    )
  }
}

async function listCandidates({ excludeSowId, excludeCycleId } = {}) {
  const rows = await sowDonationRepository.listLactationCandidates({
    excludeSowId,
    excludeCycleId,
  })

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const out = await sowDonationRepository.sumDonatedOut(row.cycleId)
      const inn = await sowDonationRepository.sumDonatedIn(row.cycleId)
      const cycle = {
        bornAlive: row.bornAlive,
        deadLactation: row.deadLactation,
        weanDate: row.weanDate,
        weanQty: row.weanQty,
      }
      const lactationEffective = effectiveLactationCount(cycle, out, inn)
      return {
        ...row,
        donatedOutTotal: out,
        donatedInTotal: inn,
        lactationEffective,
        openForDonation: isCycleOpenForDonation(cycle, out, inn),
      }
    }),
  )

  return { candidates: enriched.filter((c) => c.openForDonation) }
}

async function createDonation(body, userId) {
  const fromCycleId = String(body.fromCycleId || '').trim()
  const toCycleId = String(body.toCycleId || '').trim()
  const quantity = Number(body.quantity)
  const donationDate =
    body.donationDate != null && String(body.donationDate).trim()
      ? normalizeIsoDate(body.donationDate) || String(body.donationDate).trim()
      : todayIsoLocal()

  if (!fromCycleId || !toCycleId) {
    throw new AppError('Indicá las dos cerdas del traspaso.', 400)
  }
  if (fromCycleId === toCycleId) {
    throw new AppError('No podés donar lechones al mismo ciclo.', 400)
  }
  if (!Number.isFinite(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
    throw new AppError('La cantidad debe ser un entero mayor a cero.', 400)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const { cycle: fromCycle, sowId: fromSowId } = await getCycleWithSow(fromCycleId, conn)
    const { cycle: toCycle, sowId: toSowId } = await getCycleWithSow(toCycleId, conn)

    if (fromSowId === toSowId) {
      throw new AppError('Elegí otra cerda distinta para la donación.', 400)
    }

    const fromOut = await sowDonationRepository.sumDonatedOut(fromCycleId, conn)
    const fromIn = await sowDonationRepository.sumDonatedIn(fromCycleId, conn)
    const toOut = await sowDonationRepository.sumDonatedOut(toCycleId, conn)
    const toIn = await sowDonationRepository.sumDonatedIn(toCycleId, conn)

    await assertCycleReadyForDonation(fromCycle, 'Cerda que entrega', fromOut, fromIn)
    await assertCycleReadyForDonation(toCycle, 'Cerda que recibe', toOut, toIn)
    const available = effectiveLactationCount(fromCycle, fromOut, fromIn)

    if (quantity > available) {
      throw new AppError(
        `La cerda que entrega tiene ${available} lechón(es) disponible(s) en lactancia (nacidos − M/L − entregados + recibidos).`,
        409,
      )
    }

    const id = randomUUID()
    await sowDonationRepository.insertDonation(conn, {
      id,
      fromCycleId,
      toCycleId,
      quantity,
      donationDate,
      notes: body.notes != null ? String(body.notes).trim() : null,
      createdBy: userId,
    })

    await conn.commit()

    const donation = await sowDonationRepository.findDonationById(id)
    const fromSow = await enrichSowWithDonations(await sowRepository.getSowWithCycles(fromSowId))
    const toSow = await enrichSowWithDonations(await sowRepository.getSowWithCycles(toSowId))

    return { donation, fromSow, toSow }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

async function removeDonation(donationId) {
  const existing = await sowDonationRepository.findDonationById(donationId)
  if (!existing) throw new AppError('Donación no encontrada.', 404)

  const owners = await sowRepository.findCycleOwners(null, [
    existing.fromCycleId,
    existing.toCycleId,
  ])
  const fromSowId = owners.get(existing.fromCycleId)
  const toSowId = owners.get(existing.toCycleId)

  await sowDonationRepository.deleteDonationById(donationId)

  const fromSow = fromSowId
    ? await enrichSowWithDonations(await sowRepository.getSowWithCycles(fromSowId))
    : null
  const toSow = toSowId
    ? await enrichSowWithDonations(await sowRepository.getSowWithCycles(toSowId))
    : null

  return { deleted: true, fromSow, toSow }
}

module.exports = {
  enrichSowWithDonations,
  listCandidates,
  createDonation,
  removeDonation,
  isCycleOpenForDonation,
  effectiveLactationCount,
}
