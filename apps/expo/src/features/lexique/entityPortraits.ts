// Shared by the native screens and the Bible DOM: no React Native import here.
import Color from 'color'

/** The portraits of biblical entities on the public media host (ADR-0089). */
export const ENTITY_PORTRAIT_BASE_URL = 'https://media.bible-strong.app/entity-images'
export const ENTITY_PORTRAIT_CATALOG_URL = `${ENTITY_PORTRAIT_BASE_URL}/catalog.json`

/** 256 pixels fill every avatar; 768 an enlarged portrait or a card; 1254 the whole painting. */
export type EntityPortraitSize = 'w256' | 'w768' | 'w1254'

/** A portrait, or one of its stages: both live under the entity's unique name. */
export const getEntityPortraitUri = (
  uniqueName: string,
  hash: string,
  size: EntityPortraitSize = 'w256'
) => `${ENTITY_PORTRAIT_BASE_URL}/${encodeURIComponent(uniqueName)}/${hash}/${size}.webp`

/**
 * Avatars are rounded squares whose corner grows with them, in the proportion of the app's icon
 * tiles (radius 8 on 30).
 */
export const getEntityAvatarRadius = (size: number) => Math.round(size * 0.27)

/**
 * The ground behind a portrait, as a CSS background: characters are published cut out, so the app
 * draws the dusk blue they were painted on in a dark theme and, in a light one, the theme's light
 * primary deepened towards its primary at the centre (ADR-0089). Places keep their painting, which
 * covers it.
 */
export const getEntityPortraitGround = (
  dark: boolean,
  colors: { primary: string; lightPrimary: string }
) => {
  if (dark) return 'radial-gradient(circle at 50% 35%, #4d6a99 0%, #2e466a 55%, #1b2a43 100%)'
  const centre = Color(colors.lightPrimary).mix(Color(colors.primary), 0.22).rgb().string()
  return `radial-gradient(circle at 50% 35%, ${centre} 0%, ${colors.lightPrimary} 75%)`
}

/** Unique name → hash of the picture to show. An entity absent from it has none. */
export type EntityPortraitHashes = Record<string, string>

/** Unique name → address of the picture to show, a local file or the media host's copy. */
export type EntityPortraitSources = Record<string, string>

/** A text of the catalog in each active language of the application. */
export type EntityPortraitText = { fr: string; en: string }

/** The text in the given language; English for a language the catalog does not carry. */
export const getEntityPortraitText = (text: EntityPortraitText, language: string) =>
  language === 'fr' ? text.fr : text.en

/** Chapters with the application's book numbers; verses only when two pictures share a chapter. */
export type EntityChapterRange = {
  book: number
  from: number
  to: number
  fromVerse?: number
  toVerse?: number
}

export type EntityPortraitStage = {
  key: string
  label: EntityPortraitText
  hash: string
  ranges: EntityChapterRange[]
}

export type EntityPortraitEntry = {
  hash: string
  title?: EntityPortraitText
  /** "Manifestations" for God; life stages otherwise. */
  stagesLabel?: EntityPortraitText
  roles?: string[]
  stages?: EntityPortraitStage[]
}

/** What the media host says of the portraits: hashes, titles, stages, series and roles. */
export type EntityPortraitCatalog = {
  entities: Record<string, EntityPortraitEntry>
  series: { id: string; title: EntityPortraitText; members: string[] }[]
  roles: Record<string, EntityPortraitText>
}

const HASH_PATTERN = /^[0-9a-f]{6,64}$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isText = (value: unknown): value is EntityPortraitText =>
  isRecord(value) &&
  typeof value.fr === 'string' &&
  !!value.fr &&
  typeof value.en === 'string' &&
  !!value.en

const parseRange = (value: unknown): EntityChapterRange | undefined => {
  if (!isRecord(value)) return undefined
  const { book, from, to, fromVerse, toVerse } = value
  if (!isPositiveInteger(book) || !isPositiveInteger(from) || !isPositiveInteger(to))
    return undefined
  if (isPositiveInteger(fromVerse) && isPositiveInteger(toVerse))
    return { book, from, to, fromVerse, toVerse }
  return { book, from, to }
}

const parseStage = (value: unknown): EntityPortraitStage | undefined => {
  if (!isRecord(value)) return undefined
  const { key, label, hash, ranges } = value
  if (typeof key !== 'string' || !isText(label)) return undefined
  if (typeof hash !== 'string' || !HASH_PATTERN.test(hash) || !Array.isArray(ranges))
    return undefined
  const parsed = ranges.map(parseRange).filter((range): range is EntityChapterRange => !!range)
  return parsed.length ? { key, label, hash, ranges: parsed } : undefined
}

const parseEntry = (value: unknown): EntityPortraitEntry | undefined => {
  if (!isRecord(value) || typeof value.hash !== 'string' || !HASH_PATTERN.test(value.hash))
    return undefined
  const stages = Array.isArray(value.stages)
    ? value.stages.map(parseStage).filter((stage): stage is EntityPortraitStage => !!stage)
    : []
  const roles = Array.isArray(value.roles)
    ? value.roles.filter((role): role is string => typeof role === 'string')
    : []
  return {
    hash: value.hash,
    ...(isText(value.title) ? { title: value.title } : {}),
    ...(isText(value.stagesLabel) ? { stagesLabel: value.stagesLabel } : {}),
    ...(roles.length ? { roles } : {}),
    ...(stages.length ? { stages } : {}),
  }
}

/** Keeps the well-formed entries of a published catalog, or nothing when it is not one. */
export const parseEntityPortraitCatalog = (value: unknown): EntityPortraitCatalog | undefined => {
  if (!isRecord(value) || value.version !== 3 || !isRecord(value.entities)) return undefined
  const entities = Object.fromEntries(
    Object.entries(value.entities).flatMap(([uniqueName, entry]) => {
      const parsed = parseEntry(entry)
      return parsed ? [[uniqueName, parsed]] : []
    })
  )
  const series = Array.isArray(value.series)
    ? value.series.filter(
        (item): item is EntityPortraitCatalog['series'][number] =>
          isRecord(item) &&
          typeof item.id === 'string' &&
          isText(item.title) &&
          Array.isArray(item.members) &&
          item.members.every(member => typeof member === 'string')
      )
    : []
  const roles = isRecord(value.roles)
    ? Object.fromEntries(
        Object.entries(value.roles).filter((entry): entry is [string, EntityPortraitText] =>
          isText(entry[1])
        )
      )
    : {}
  return { entities, series, roles }
}

/** The portrait of each entity, whatever the chapter. */
export const getEntityPortraitHashes = (catalog: EntityPortraitCatalog): EntityPortraitHashes =>
  Object.fromEntries(Object.entries(catalog.entities).map(([name, entry]) => [name, entry.hash]))

/** Every picture the catalog names, portraits and stages, once each, with the entity it is stored under. */
export const getEntityPortraitPictures = (catalog: EntityPortraitCatalog) => {
  const pictures = new Map<string, string>()
  for (const [uniqueName, entry] of Object.entries(catalog.entities)) {
    for (const hash of [entry.hash, ...(entry.stages ?? []).map(stage => stage.hash)]) {
      if (!pictures.has(hash)) pictures.set(hash, uniqueName)
    }
  }
  return [...pictures].map(([hash, uniqueName]) => ({ hash, uniqueName }))
}

/** What a device holding `local` must download and delete to hold exactly the `wanted` pictures. */
export const planEntityPortraitPack = (wanted: string[], local: string[]) => {
  const wantedSet = new Set(wanted)
  const localSet = new Set(local)
  return {
    missing: wanted.filter(hash => !localSet.has(hash)),
    obsolete: local.filter(hash => !wantedSet.has(hash)),
  }
}

/**
 * The picture of an entity for a whole chapter: the stage that covers it, or the portrait. A stage
 * that starts after the chapter's first verse does not stand for the whole chapter.
 */
export const getEntityChapterPortraitHash = (
  entry: EntityPortraitEntry,
  book: number,
  chapter: number
) =>
  entry.stages?.find(stage =>
    stage.ranges.some(
      range =>
        range.book === book &&
        range.from <= chapter &&
        chapter <= range.to &&
        (range.fromVerse === undefined || range.fromVerse === 1)
    )
  )?.hash ?? entry.hash

/** The series an entity belongs to, and its place in it, from 1. */
export const getEntitySeriesPlace = (catalog: EntityPortraitCatalog, uniqueName: string) => {
  const series = catalog.series.find(item => item.members.includes(uniqueName))
  return series
    ? {
        title: series.title,
        rank: series.members.indexOf(uniqueName) + 1,
        total: series.members.length,
      }
    : undefined
}

/** A stage's chapters as the reader reads them: « 1 Samuel 18–31 ; 1 Chroniques 11–29 ». */
export const formatEntityChapterRanges = (
  ranges: EntityChapterRange[],
  getBookName: (book: number) => string
) =>
  ranges
    .map(range => {
      const book = getBookName(range.book)
      if (range.fromVerse !== undefined && range.toVerse !== undefined)
        return `${book} ${range.from}:${range.fromVerse}–${range.toVerse}`
      return range.from === range.to ? `${book} ${range.from}` : `${book} ${range.from}–${range.to}`
    })
    .join(' ; ')

// FNV-1a: the same unique name picks the same placeholder on every platform and every launch.
const stableHash = (text: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Which of the `count` placeholders of its avatar key an entity shows, from 0 to count - 1. */
export const getEntityPlaceholderIndex = (seed: string, count: number) => stableHash(seed) % count
