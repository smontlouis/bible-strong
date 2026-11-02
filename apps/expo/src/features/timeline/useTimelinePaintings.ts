import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { useEffect } from 'react'

import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import {
  getTimelinePaintingUri,
  parseTimelinePaintings,
  TIMELINE_PAINTING_CATALOG_URL,
  type TimelinePaintings,
  type TimelinePaintingSize,
} from './timelinePaintings'

const REFRESH_INTERVAL = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT = 10_000

/** The last catalog read from the media host, kept on the device (ADR-0096). */
const timelinePaintingsAtom = atomWithAsyncStorage<{
  fetchedAt: number
  paintings: TimelinePaintings
} | null>('timelinePaintings', null)

// Whether this launch has read the catalog or given up on it.
const catalogSettledAtom = atom(false)

// One attempt per launch: a failure keeps the last copy until the next launch.
let refreshAttempted = false

const refreshTimelinePaintings = async () => {
  if (refreshAttempted) return
  refreshAttempted = true
  const store = getDefaultStore()
  const current = store.get(timelinePaintingsAtom)
  if (current && Date.now() - current.fetchedAt < REFRESH_INTERVAL) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(TIMELINE_PAINTING_CATALOG_URL, { signal: controller.signal })
    if (!response.ok) return
    const paintings = parseTimelinePaintings(await response.json())
    if (paintings) store.set(timelinePaintingsAtom, { fetchedAt: Date.now(), paintings })
  } catch {
    // Offline or unreachable: events keep the last copy, or the publication's pictures.
  } finally {
    clearTimeout(timeout)
    store.set(catalogSettledAtom, true)
  }
}

/**
 * The paintings known to this device, refreshed from the media host once a day. `known` stays
 * false until a catalog has arrived or failed: an event then waits rather than flash its old image.
 */
export const useTimelinePaintings = () => {
  const state = useAtomValue(timelinePaintingsAtom)
  const settled = useAtomValue(catalogSettledAtom)
  useEffect(() => {
    refreshTimelinePaintings()
  }, [])
  return { paintings: state?.paintings, known: Boolean(state) || settled }
}

/** The picture of an event at one size: its painting, or `fallback` when it has none. */
export const useTimelineEventPicture = (
  slug: string,
  fallback: string | undefined,
  size: TimelinePaintingSize
) => {
  const { paintings, known } = useTimelinePaintings()
  const painting = paintings?.[slug]
  if (painting) return getTimelinePaintingUri(slug, painting.hash, size)
  return known ? fallback : undefined
}
