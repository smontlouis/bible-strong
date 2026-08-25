import { BUNDLED_MOBILE_RESOURCE_CATALOG, getCatalogBibleVersionIds } from './catalog'

export const ORDINARY_BIBLE_VERSION_IDS = Object.freeze(
  getCatalogBibleVersionIds(BUNDLED_MOBILE_RESOURCE_CATALOG)
)

export const ONLINE_BIBLE_VERSION_IDS = ORDINARY_BIBLE_VERSION_IDS

const ordinaryBibleVersionIds = new Set<string>(ORDINARY_BIBLE_VERSION_IDS)

export const isOrdinaryBibleVersionId = (versionId: string): boolean =>
  ordinaryBibleVersionIds.has(versionId)
