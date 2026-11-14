import { getDefaultStore, useAtomValue } from 'jotai'
import { useEffect } from 'react'

import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

import {
  ENTITY_CARD_CATALOG_URL,
  parseEntityCardCatalog,
  type EntityCardCatalog,
} from './entityCards'

type EntityCardCatalogState = {
  fetchedAt: number
  catalog: EntityCardCatalog
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
  if (current && Date.now() - current.fetchedAt < REFRESH_INTERVAL) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(ENTITY_CARD_CATALOG_URL, { signal: controller.signal })
    if (!response.ok) return
    const catalog = parseEntityCardCatalog(await response.json())
    if (catalog) store.set(entityCardCatalogAtom, { fetchedAt: Date.now(), catalog })
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
