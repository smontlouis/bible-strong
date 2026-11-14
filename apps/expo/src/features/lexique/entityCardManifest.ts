import { getDefaultStore, useAtomValue } from 'jotai'
import { useEffect } from 'react'

import { parseCardCatalog, type CardCatalog } from '~features/entity-cards/cardCatalog'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

import {
  ENTITY_CARD_CATALOG_URL,
  parseEntityCardCatalog,
  type EntityCardCatalog,
} from './entityCards'

type EntityCardCatalogState = {
  fetchedAt: number
  /** The backdrop of each card, for the portraits of the profiles. */
  catalog: EntityCardCatalog
  /** Every card with its texts, for drawing and collecting them; absent from older copies. */
  cards?: CardCatalog
}

/** The last card catalog read from the media host, kept for offline use (ADR-0090). */
const entityCardCatalogAtom = atomWithAsyncStorage<EntityCardCatalogState | null>(
  'entityCardCatalog',
  null
)

const REFRESH_INTERVAL = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT = 10_000

// One attempt per launch: a failure keeps the last copy until the next launch.
let refreshAttempted = false

const refreshEntityCardCatalog = async () => {
  if (refreshAttempted) return
  refreshAttempted = true

  const store = getDefaultStore()
  const current = store.get(entityCardCatalogAtom)
  if (current?.cards && Date.now() - current.fetchedAt < REFRESH_INTERVAL) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(ENTITY_CARD_CATALOG_URL, { signal: controller.signal })
    if (!response.ok) return
    const published: unknown = await response.json()
    const catalog = parseEntityCardCatalog(published)
    const cards = parseCardCatalog(published)
    if (catalog && cards) {
      store.set(entityCardCatalogAtom, { fetchedAt: Date.now(), catalog, cards })
    }
  } catch {
    // Offline or unreachable: the portraits keep the ground the application draws.
  } finally {
    clearTimeout(timeout)
  }
}

/** The cards known to this device, refreshed from the media host once a day. */
export const useEntityCardCatalog = (): EntityCardCatalog | undefined => {
  const state = useAtomValue(entityCardCatalogAtom)
  useEffect(() => {
    void refreshEntityCardCatalog()
  }, [])
  return state?.catalog
}

/** Every card of the catalog known to this device, refreshed from the media host once a day. */
export const useCardCatalog = (): CardCatalog | undefined => {
  const state = useAtomValue(entityCardCatalogAtom)
  useEffect(() => {
    void refreshEntityCardCatalog()
  }, [])
  return state?.cards
}
