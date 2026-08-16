import mobileResourceCatalog from '../assets/mobile-resource-catalog.json'

export const ORDINARY_BIBLE_VERSION_IDS = Object.freeze(
  Object.keys(mobileResourceCatalog.resources)
    .filter(resourceId => resourceId.startsWith('bible:'))
    .map(resourceId => resourceId.slice('bible:'.length))
    .sort()
)

export const PUBLIC_ONLINE_BIBLE_VERSION_IDS = Object.freeze([
  'ASV',
  'BHG',
  'BSB',
  'DARBY',
  'DBY',
  'FMAR',
  'LAU',
  'LSG',
  'OST',
  'RV1895',
  'RWEBSTER',
  'VUL',
])

const ordinaryBibleVersionIds = new Set<string>(ORDINARY_BIBLE_VERSION_IDS)

export const isOrdinaryBibleVersionId = (versionId: string): boolean =>
  ordinaryBibleVersionIds.has(versionId)
