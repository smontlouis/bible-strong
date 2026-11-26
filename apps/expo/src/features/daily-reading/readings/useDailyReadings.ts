import { useQuery } from '@tanstack/react-query'
import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { localQueryOptions } from '~helpers/queryOptions'
import {
  DAILY_READINGS_CATALOG_URL,
  getDailyEntryKey,
  getDailySceneUri,
  parseDailyCatalog,
  parseDailyCollection,
  type DailyCatalog,
  type DailyCollection,
  type DailySceneLayer,
} from './dailyReadingFormat'
import { downloadCollection, readKeptCollection } from './dailyReadingStore'

const FETCH_TIMEOUT = 10_000

/** The last catalog read from the media host, kept on the device. */
const dailyCatalogAtom = atomWithAsyncStorage<DailyCatalog | null>('dailyReadingsCatalog', null)
// Whether this launch has read the catalog or given up on it.
const catalogSettledAtom = atom(false)
// One read per launch: a correction published today reaches the reader at the next launch.
let refreshAttempted = false

const refreshDailyCatalog = async () => {
  if (refreshAttempted) return
  refreshAttempted = true
  const store = getDefaultStore()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(DAILY_READINGS_CATALOG_URL, { signal: controller.signal })
    if (!response.ok) return
    const catalog = parseDailyCatalog(await response.json())
    if (catalog) store.set(dailyCatalogAtom, catalog)
  } catch {
    // Offline or unreachable: the collections keep the copy this device holds.
  } finally {
    clearTimeout(timeout)
    store.set(catalogSettledAtom, true)
  }
}

/** The catalog known to this device; `settled` once this launch has read it or given up. */
export const useDailyCatalog = () => {
  const catalog = useAtomValue(dailyCatalogAtom)
  const settled = useAtomValue(catalogSettledAtom)
  useEffect(() => {
    void refreshDailyCatalog()
  }, [])
  return { catalog: catalog ?? undefined, settled }
}

export class DailyReadingUnavailable extends Error {
  constructor() {
    super('DAILY_READING_UNAVAILABLE')
  }
}

const parseOrUndefined = (text: string, id: string) => {
  try {
    return parseDailyCollection(JSON.parse(text), id)
  } catch {
    return undefined
  }
}

/**
 * The kept copy while it is the current one (or while the catalog is unknown), else the current
 * file, downloaded and kept; the kept copy again when that download fails.
 */
export const loadDailyCollection = async (
  id: string,
  hash: string | undefined
): Promise<DailyCollection> => {
  const kept = await readKeptCollection(id)
  const keptCollection = kept && parseOrUndefined(kept.text, id)
  if (keptCollection && (!hash || kept.hash === hash)) return keptCollection
  if (hash) {
    try {
      const fresh = parseOrUndefined(await downloadCollection(id, hash), id)
      if (fresh) return fresh
    } catch (error) {
      if (!keptCollection) throw error
    }
  }
  if (keptCollection) return keptCollection
  throw new DailyReadingUnavailable()
}

export const dailyCollectionQueryKey = (id: string | undefined, hash: string | undefined) =>
  ['daily-reading-collection', id ?? null, hash ?? null] as const

/** A collection of the media host, read from this device's copy and kept current. */
export const useDailyCollection = (id: string | undefined) => {
  const { catalog, settled } = useDailyCatalog()
  const hash = id ? catalog?.collections[id]?.hash : undefined
  return useQuery({
    queryKey: dailyCollectionQueryKey(id, hash),
    queryFn: () => loadDailyCollection(id!, hash),
    // A catalog kept from an earlier launch is enough to start; a first launch waits for it.
    enabled: Boolean(id) && (Boolean(hash) || settled),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    ...localQueryOptions,
  })
}

/** The entry of a civil date in a collection, with the key that identifies it. */
export const useDailyEntry = (id: string | undefined, date: string, override?: string) => {
  const query = useDailyCollection(id)
  const collection = query.data
  const key = collection ? (override ?? getDailyEntryKey(collection, date)) : undefined
  const entry = key ? collection?.entries[key] : undefined
  return {
    collection,
    key: entry ? key : undefined,
    entry,
    isLoading: query.isPending && query.fetchStatus !== 'idle',
    isError: query.isError,
    retry: query.refetch,
  }
}

/** The address of one layer of a scene, at the smallest width that covers `minWidth`. */
export const useDailySceneUri = (
  sceneId: string | undefined,
  layer: DailySceneLayer,
  minWidth: number
) => {
  const { catalog } = useDailyCatalog()
  const scene = sceneId ? catalog?.scenes[sceneId] : undefined
  return sceneId && scene ? getDailySceneUri(sceneId, scene, layer, minWidth) : undefined
}
