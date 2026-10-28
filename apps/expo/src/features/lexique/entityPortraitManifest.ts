import { getDefaultStore, useAtomValue } from 'jotai'
import { useEffect, useMemo } from 'react'

import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import {
  ENTITY_PORTRAIT_CATALOG_URL,
  getEntityPortraitHashes,
  parseEntityPortraitCatalog,
  type EntityPortraitCatalog,
  type EntityPortraitHashes,
} from './entityPortraits'

type EntityPortraitCatalogState = {
  fetchedAt: number
  catalog: EntityPortraitCatalog
}

const REFRESH_INTERVAL = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT = 10_000

/** The last catalog read from the media host, kept for offline use (ADR-0089). */
const entityPortraitCatalogAtom = atomWithAsyncStorage<EntityPortraitCatalogState | null>(
  'entityPortraitCatalog',
  null
)

// One attempt per launch: a failure keeps the last copy until the next launch.
let refreshAttempted = false

const refreshEntityPortraitCatalog = async () => {
  if (refreshAttempted) return
  refreshAttempted = true
  const store = getDefaultStore()
  const current = store.get(entityPortraitCatalogAtom)
  if (current && Date.now() - current.fetchedAt < REFRESH_INTERVAL) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(ENTITY_PORTRAIT_CATALOG_URL, { signal: controller.signal })
    if (!response.ok) return
    const catalog = parseEntityPortraitCatalog(await response.json())
    if (catalog) store.set(entityPortraitCatalogAtom, { fetchedAt: Date.now(), catalog })
  } catch {
    // Offline or unreachable: the placeholders stand in.
  } finally {
    clearTimeout(timeout)
  }
}

/** The portraits known to this device, refreshed from the media host once a day. */
export const useEntityPortraitCatalog = (): EntityPortraitCatalog | undefined => {
  const state = useAtomValue(entityPortraitCatalogAtom)
  useEffect(() => {
    refreshEntityPortraitCatalog()
  }, [])
  return state?.catalog
}

const NO_PORTRAITS: EntityPortraitHashes = {}

/** The portrait of each entity known to this device, whatever the chapter. */
export const useEntityPortraitHashes = (): EntityPortraitHashes => {
  const catalog = useEntityPortraitCatalog()
  return useMemo(() => (catalog ? getEntityPortraitHashes(catalog) : NO_PORTRAITS), [catalog])
}

export const useEntityPortraitHash = (uniqueName: string | undefined) => {
  const catalog = useEntityPortraitCatalog()
  return uniqueName ? catalog?.entities[uniqueName]?.hash : undefined
}
