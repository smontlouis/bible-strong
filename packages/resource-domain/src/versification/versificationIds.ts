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
  'bs-esv',
  'bs-niv',
  'bs-gw',
  'bs-csb',
  'bs-net',
  'bs-easy',
  'bs-bfc',
  'bs-nfc',
  'bs-pdv',
  'bs-tlv',
  'bs-del',
  'bs-chu',
  'bs-sblgnt',
  'bs-pov',
] as const

export type VersificationId = (typeof VERSIFICATION_ID_LIST)[number]
