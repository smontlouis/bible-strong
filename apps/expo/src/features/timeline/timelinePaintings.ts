import { getTimelineImageUri } from './timelineImage'

/** The paintings of the timeline on the public media host (ADR-0096). */
export const TIMELINE_PAINTING_BASE_URL = 'https://media.bible-strong.app/timeline-paintings'
export const TIMELINE_PAINTING_CATALOG_URL = `${TIMELINE_PAINTING_BASE_URL}/catalog.json`

/** 256 pixels fill the drawn timeline and the search; 768 a card; 1254 the whole painting. */
export type TimelinePaintingSize = 'w256' | 'w768' | 'w1254'

export const getTimelinePaintingUri = (slug: string, hash: string, size: TimelinePaintingSize) =>
  `${TIMELINE_PAINTING_BASE_URL}/${slug}/${hash}/${size}.webp`

export type TimelinePainting = {
  hash: string
  /** The files of the publication shown beside the painting. */
  documents: string[]
}

/** Slug → painting. An event absent from it keeps the publication's pictures. */
export type TimelinePaintings = Record<string, TimelinePainting>

const HASH_PATTERN = /^[0-9a-f]{6,64}$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const parsePainting = (value: unknown): TimelinePainting | undefined => {
  if (!isRecord(value) || typeof value.hash !== 'string' || !HASH_PATTERN.test(value.hash))
    return undefined
  const documents = Array.isArray(value.documents)
    ? value.documents.filter((file): file is string => typeof file === 'string')
    : []
  return { hash: value.hash, documents }
}

/** Keeps the well-formed entries of a published catalog, or nothing when it is not one. */
export const parseTimelinePaintings = (value: unknown): TimelinePaintings | undefined => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.events)) return undefined
  return Object.fromEntries(
    Object.entries(value.events).flatMap(([slug, entry]) => {
      const painting = parsePainting(entry)
      return painting ? [[slug, painting]] : []
    })
  )
}

export type TimelinePicture = { uri: string; caption: string }

/** The pictures of an event: its painting, then its documents; without one, the publication's. */
export const getTimelineEventPictures = (
  slug: string,
  images: readonly { caption: string; file: string }[] | undefined,
  painting: TimelinePainting | undefined
): TimelinePicture[] => {
  const shown = (images ?? []).filter(image => !painting || painting.documents.includes(image.file))
  const pictures = shown.flatMap(({ caption, file }) => {
    const uri = getTimelineImageUri(file, 'original')
    return uri ? [{ uri, caption }] : []
  })
  return painting
    ? [{ uri: getTimelinePaintingUri(slug, painting.hash, 'w1254'), caption: '' }, ...pictures]
    : pictures
}
