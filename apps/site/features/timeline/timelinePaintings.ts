// The paintings of the timeline as the application shows them (ADR-0096). The rules mirror
// `apps/expo/src/features/timeline/timelinePaintings.ts`: an event wears the same picture in both.
import { noteStaleAnswer } from '../resources/staleAnswers'
import { timelineImageUrl, timelineThumbnailUrl } from './timelineEvents'

const TIMELINE_PAINTING_BASE_URL = 'https://media.bible-strong.app/timeline-paintings'
const TIMELINE_PAINTING_CATALOG_URL = `${TIMELINE_PAINTING_BASE_URL}/catalog.json`

export type TimelinePaintingSize = 'w256' | 'w768' | 'w1254'

export const timelinePaintingUrl = (
  slug: string,
  hash: string,
  size: TimelinePaintingSize
): string => `${TIMELINE_PAINTING_BASE_URL}/${slug}/${hash}/${size}.webp`

export type TimelinePainting = {
  hash: string
  /** The files of the publication shown beside the painting. */
  documents: string[]
}

/** Slug → painting. An event absent from it keeps the publication's pictures. */
export type TimelinePaintings = Record<string, TimelinePainting>

const HASH_PATTERN = /^[0-9a-f]{6,64}$/u
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const parsePainting = (value: unknown): TimelinePainting | undefined => {
  if (!isRecord(value) || typeof value.hash !== 'string' || !HASH_PATTERN.test(value.hash)) {
    return undefined
  }
  return {
    hash: value.hash,
    documents: Array.isArray(value.documents)
      ? value.documents.filter((file): file is string => typeof file === 'string')
      : [],
  }
}

/** The well-formed entries of the published catalog, or nothing when it is not one. */
export const parseTimelinePaintings = (value: unknown): TimelinePaintings | undefined => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.events)) return undefined
  return Object.fromEntries(
    Object.entries(value.events).flatMap(([slug, entry]) => {
      const painting = parsePainting(entry)
      return painting ? [[slug, painting]] : []
    })
  )
}

const CATALOG_KEPT_MS = 60 * 60 * 1000
const CATALOG_TIMEOUT_MS = 5_000

let catalogCache: { at: number; paintings: TimelinePaintings } | undefined

/**
 * The paintings of the media host. Events keep the publication's pictures when they cannot be
 * read, and such a page is kept a minute only, like one rendered with a STALE answer.
 */
export const readTimelinePaintings = async (): Promise<TimelinePaintings> => {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_KEPT_MS) return catalogCache.paintings
  try {
    const response = await fetch(TIMELINE_PAINTING_CATALOG_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Painting catalog responded ${response.status}`)
    const paintings = parseTimelinePaintings(await response.json())
    if (!paintings) throw new Error('Painting catalog unreadable')
    catalogCache = { at: Date.now(), paintings }
    return paintings
  } catch {
    noteStaleAnswer()
    return catalogCache?.paintings ?? {}
  }
}

/** The small picture of an event: its painting, or the first picture of the publication. */
export const timelineEventThumbnail = (
  paintings: TimelinePaintings,
  event: { slug: string; image?: string },
  size: TimelinePaintingSize
): string | undefined => {
  const painting = paintings[event.slug]
  if (painting) return timelinePaintingUrl(event.slug, painting.hash, size)
  return event.image ? timelineThumbnailUrl(event.image) : undefined
}

/** The pictures of an event: its painting, then its documents; without one, the publication's. */
export const timelineEventPictures = (
  slug: string,
  images: readonly { caption: string; file: string }[],
  painting: TimelinePainting | undefined
): { src: string; caption: string }[] => {
  const shown = images.filter(image => !painting || painting.documents.includes(image.file))
  const pictures = shown.flatMap(image => {
    const src = timelineImageUrl(image.file)
    return src ? [{ src, caption: image.caption }] : []
  })
  return painting
    ? [{ src: timelinePaintingUrl(slug, painting.hash, 'w1254'), caption: '' }, ...pictures]
    : pictures
}
