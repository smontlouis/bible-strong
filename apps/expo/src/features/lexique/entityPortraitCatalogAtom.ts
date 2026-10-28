import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

import type { EntityPortraitCatalog } from './entityPortraits'

export type EntityPortraitCatalogState = {
  fetchedAt: number
  catalog: EntityPortraitCatalog
}

/** The last catalog read from the media host, kept for offline use (ADR-0089). */
export const entityPortraitCatalogAtom = atomWithAsyncStorage<EntityPortraitCatalogState | null>(
  'entityPortraitCatalog',
  null
)
