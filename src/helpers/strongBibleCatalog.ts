export type StrongBibleVersionId =
  | 'LSG'
  | 'DBY'
  | 'DBR'
  | 'KJV'
  | 'NASB2020'
  | 'NASB1995'
  | 'BSB'
  | 'ASV'
  | 'DARBY'
  | 'RLT'
  | 'RWEBSTER'
  | 'RV1895'

export type StrongBibleDatasetId =
  | 'LSG'
  | 'DBY'
  | 'DBYR'
  | 'KJV'
  | 'NASB2020'
  | 'NASB1995'
  | 'BSB'
  | 'ASV'
  | 'DARBY_EN'
  | 'RLT'
  | 'RWEBSTER'
  | 'RV1895'

export const FRENCH_STRONG_BIBLE_PRIORITY = ['LSG', 'DBY', 'DBR'] as const
export const ENGLISH_STRONG_BIBLE_PRIORITY = [
  'KJV',
  'NASB2020',
  'NASB1995',
  'BSB',
  'ASV',
  'DARBY',
  'RLT',
  'RWEBSTER',
  'RV1895',
] as const
export const STRONG_BIBLE_FALLBACK_PRIORITY = [
  ...FRENCH_STRONG_BIBLE_PRIORITY,
  ...ENGLISH_STRONG_BIBLE_PRIORITY,
] as const satisfies readonly StrongBibleVersionId[]

const DATASET_BY_VERSION = {
  LSG: 'LSG',
  DBY: 'DBY',
  DBR: 'DBYR',
  KJV: 'KJV',
  NASB2020: 'NASB2020',
  NASB1995: 'NASB1995',
  BSB: 'BSB',
  ASV: 'ASV',
  DARBY: 'DARBY_EN',
  RLT: 'RLT',
  RWEBSTER: 'RWEBSTER',
  RV1895: 'RV1895',
} as const satisfies Record<StrongBibleVersionId, StrongBibleDatasetId>

export const isStrongBibleVersionId = (value: string): value is StrongBibleVersionId =>
  value in DATASET_BY_VERSION

export const getStrongBibleCatalogIdentity = (versionId: StrongBibleVersionId) => ({
  versionId,
  datasetId: DATASET_BY_VERSION[versionId],
  language: FRENCH_STRONG_BIBLE_PRIORITY.includes(
    versionId as (typeof FRENCH_STRONG_BIBLE_PRIORITY)[number]
  )
    ? ('fr' as const)
    : ('en' as const),
})
