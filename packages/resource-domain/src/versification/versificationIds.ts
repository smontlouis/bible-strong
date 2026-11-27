/**
 * The verse numberings the versification module describes. Kept apart from the tables so that a
 * contract can name them without loading the tables.
 */
export const VERSIFICATION_ID_LIST = [
  'org',
  'bs-eng',
  'bs-kjv',
  'bs-nrsv',
  'bs-neg79',
  'bs-ost',
  'bs-fmar',
  'bs-lau',
] as const

export type VersificationId = (typeof VERSIFICATION_ID_LIST)[number]
