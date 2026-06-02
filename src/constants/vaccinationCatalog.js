/**
 * Plan vacunal según protocolo de gestación (12 sem preñez = 84–90 días post F/S)
 * y maternidad (hembra día 10–12 post parto; lechones día 2 y día 21).
 * Claves estables para sincronizar con `sow_cycle_vaccinations.vaccine_key`.
 */

/** @typedef {{ key: string, category: string, sortOrder: number, label: string, doseText: string, isOptional: boolean, anchor: 'fs'|'frp', dayOffset: number, windowEndOffset: number | null }} VaccinationCatalogItem */

/** @type {VaccinationCatalogItem[]} */
const VACCINATION_CATALOG = [
  // PLAN GESTACIÓN — ancla F/S, ventana 84–90 días
  {
    key: 'gest_mycoplasma',
    category: 'gestacion',
    sortOrder: 10,
    label: 'Mycoplasma',
    doseText: '1 cc',
    isOptional: false,
    anchor: 'fs',
    dayOffset: 84,
    windowEndOffset: 90,
  },
  {
    key: 'gest_rinitis',
    category: 'gestacion',
    sortOrder: 20,
    label: 'Rinitis',
    doseText: '2 cc',
    isOptional: true,
    anchor: 'fs',
    dayOffset: 84,
    windowEndOffset: 90,
  },
  {
    key: 'gest_app',
    category: 'gestacion',
    sortOrder: 30,
    label: 'APP (Pleuro)',
    doseText: '2 cc',
    isOptional: false,
    anchor: 'fs',
    dayOffset: 84,
    windowEndOffset: 90,
  },
  {
    key: 'gest_ecoli_circo',
    category: 'gestacion',
    sortOrder: 40,
    label: 'E. coli 2 cc o Circovirus',
    doseText: 'Según criterio',
    isOptional: true,
    anchor: 'fs',
    dayOffset: 84,
    windowEndOffset: 90,
  },
  {
    key: 'gest_antiparasitario',
    category: 'gestacion',
    sortOrder: 50,
    label: 'Antiparasitario',
    doseText: 'Según protocolo',
    isOptional: false,
    anchor: 'fs',
    dayOffset: 84,
    windowEndOffset: 90,
  },
  // PLAN MATERNIDAD — hembra: día 10–12 post parto (F/R.P + 11)
  {
    key: 'mat_hembra_parvo_circo',
    category: 'maternidad_hembra',
    sortOrder: 100,
    label: 'Parvolepto + Circovirus (hembra)',
    doseText: 'Según protocolo',
    isOptional: false,
    anchor: 'frp',
    dayOffset: 11,
    windowEndOffset: null,
  },
  // Lechón día 2
  {
    key: 'mat_lechon_d2_hierro',
    category: 'maternidad_lechon',
    sortOrder: 200,
    label: 'Hierro dextrano (lechón)',
    doseText: '1 cc',
    isOptional: false,
    anchor: 'frp',
    dayOffset: 2,
    windowEndOffset: null,
  },
  {
    key: 'mat_lechon_d2_overcox',
    category: 'maternidad_lechon',
    sortOrder: 210,
    label: 'Overcox (lechón)',
    doseText: '1 cc oral',
    isOptional: false,
    anchor: 'frp',
    dayOffset: 2,
    windowEndOffset: null,
  },
  {
    key: 'mat_lechon_d2_despunte',
    category: 'maternidad_lechon',
    sortOrder: 220,
    label: 'Despunte colmillo y cola',
    doseText: '—',
    isOptional: false,
    anchor: 'frp',
    dayOffset: 2,
    windowEndOffset: null,
  },
  // Lechón día 21
  {
    key: 'mat_lechon_d21_myco',
    category: 'maternidad_lechon',
    sortOrder: 300,
    label: 'Mycoplasma (lechón)',
    doseText: '1 cc',
    isOptional: false,
    anchor: 'frp',
    dayOffset: 21,
    windowEndOffset: null,
  },
  {
    key: 'mat_lechon_d21_circo',
    category: 'maternidad_lechon',
    sortOrder: 310,
    label: 'Circovirus (lechón)',
    doseText: '1 cc',
    isOptional: false,
    anchor: 'frp',
    dayOffset: 21,
    windowEndOffset: null,
  },
]

module.exports = { VACCINATION_CATALOG }
