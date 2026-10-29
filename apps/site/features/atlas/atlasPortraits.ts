// The portraits of the entities as the application shows them (ADR-0089), for the atlas
// (ADR-0091). The rules mirror `apps/expo/src/features/lexique/entityPortraits.ts`: an entity
// wears the same picture, figure and ground in both.

/** The portraits of biblical entities on the public media host. */
export const ENTITY_PORTRAIT_BASE_URL = 'https://media.bible-strong.app/entity-images'
export const ENTITY_PORTRAIT_CATALOG_URL = `${ENTITY_PORTRAIT_BASE_URL}/catalog.json`

export type EntityPortraitSize = 'w256' | 'w768' | 'w1254'

export const entityPortraitUrl = (
  uniqueName: string,
  hash: string,
  size: EntityPortraitSize
): string => `${ENTITY_PORTRAIT_BASE_URL}/${encodeURIComponent(uniqueName)}/${hash}/${size}.webp`

/** A text of the catalog in each language of the site. */
export type AtlasText = { fr: string; en: string }

/** Chapters with the application's book numbers; verses only when two pictures share a chapter. */
export type AtlasChapterRange = {
  book: number
  from: number
  to: number
  fromVerse?: number
  toVerse?: number
}

export type AtlasStage = {
  key: string
  label: AtlasText
  hash: string
  ranges: AtlasChapterRange[]
}

export type AtlasPortrait = {
  hash: string
  title?: AtlasText
  /** « Manifestations » for God; life stages otherwise. */
  stagesLabel?: AtlasText
  roles: string[]
  stages: AtlasStage[]
}

export type AtlasPortraitCatalog = {
  entities: Record<string, AtlasPortrait>
  series: { id: string; title: AtlasText; members: string[] }[]
  roles: Record<string, AtlasText>
}

const HASH_PATTERN = /^[0-9a-f]{6,64}$/u
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
const isText = (value: unknown): value is AtlasText =>
  isRecord(value) &&
  typeof value.fr === 'string' &&
  !!value.fr &&
  typeof value.en === 'string' &&
  !!value.en

const parseRange = (value: unknown): AtlasChapterRange | undefined => {
  if (!isRecord(value)) return undefined
  const { book, from, to, fromVerse, toVerse } = value
  if (!isPositiveInteger(book) || !isPositiveInteger(from) || !isPositiveInteger(to)) {
    return undefined
  }
  return isPositiveInteger(fromVerse) && isPositiveInteger(toVerse)
    ? { book, from, to, fromVerse, toVerse }
    : { book, from, to }
}

const parseStage = (value: unknown): AtlasStage | undefined => {
  if (!isRecord(value)) return undefined
  const { key, label, hash, ranges } = value
  if (typeof key !== 'string' || !isText(label)) return undefined
  if (typeof hash !== 'string' || !HASH_PATTERN.test(hash) || !Array.isArray(ranges)) {
    return undefined
  }
  const parsed = ranges.map(parseRange).filter((range): range is AtlasChapterRange => !!range)
  return parsed.length ? { key, label, hash, ranges: parsed } : undefined
}

const parsePortrait = (value: unknown): AtlasPortrait | undefined => {
  if (!isRecord(value) || typeof value.hash !== 'string' || !HASH_PATTERN.test(value.hash)) {
    return undefined
  }
  return {
    hash: value.hash,
    ...(isText(value.title) ? { title: value.title } : {}),
    ...(isText(value.stagesLabel) ? { stagesLabel: value.stagesLabel } : {}),
    roles: Array.isArray(value.roles)
      ? value.roles.filter((role): role is string => typeof role === 'string')
      : [],
    stages: Array.isArray(value.stages)
      ? value.stages.map(parseStage).filter((stage): stage is AtlasStage => !!stage)
      : [],
  }
}

/** The well-formed entries of the published catalog, or nothing when it is not one. */
export const parseAtlasPortraitCatalog = (value: unknown): AtlasPortraitCatalog | undefined => {
  if (!isRecord(value) || value.version !== 3 || !isRecord(value.entities)) return undefined
  const entities = Object.fromEntries(
    Object.entries(value.entities).flatMap(([uniqueName, entry]) => {
      const parsed = parsePortrait(entry)
      return parsed ? [[uniqueName, parsed]] : []
    })
  )
  const series = Array.isArray(value.series)
    ? value.series.filter(
        (item): item is AtlasPortraitCatalog['series'][number] =>
          isRecord(item) &&
          typeof item.id === 'string' &&
          isText(item.title) &&
          Array.isArray(item.members) &&
          item.members.every(member => typeof member === 'string')
      )
    : []
  const roles = isRecord(value.roles)
    ? Object.fromEntries(
        Object.entries(value.roles).filter((entry): entry is [string, AtlasText] =>
          isText(entry[1])
        )
      )
    : {}
  return { entities, series, roles }
}

/** The clay figure an entity without a portrait wears, in the application and on the site. */
type ClayKey =
  | 'male'
  | 'female'
  | 'group'
  | 'place'
  | 'supernatural'
  | 'time'
  | 'musical'
  | 'other'
  | 'title'
  | 'language'
  | 'star'

// Five figures for people and groups, so that neighbours differ; one for the other keys.
const CLAY_COUNTS: Record<ClayKey, number> = {
  male: 5,
  female: 5,
  group: 5,
  place: 1,
  supernatural: 1,
  time: 1,
  musical: 1,
  other: 1,
  title: 1,
  language: 1,
  star: 1,
}

const OTHER_CLAY_KEYS: Record<string, ClayKey> = {
  supernatural: 'supernatural',
  time: 'time',
  musical: 'musical',
  other: 'other',
  title: 'title',
  language: 'language',
  star: 'star',
}

const clayKey = (category: string, type: string): ClayKey => {
  if (category === 'person') return type.toLowerCase() === 'female' ? 'female' : 'male'
  if (category === 'group') return 'group'
  if (category === 'place') return 'place'
  // A listed entity is `supernatural` by its type; the entity read keeps it among `other`.
  if (category === 'supernatural') return 'supernatural'
  if (category !== 'other') return 'other'
  return OTHER_CLAY_KEYS[type.toLowerCase()] ?? 'other'
}

// FNV-1a: the same unique name picks the same figure on every platform.
const stableHash = (text: string): number => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export const entityClayUrl = (category: string, type: string, uniqueName: string): string => {
  const key = clayKey(category, type)
  return `/atlas/clay/${key}-${(stableHash(uniqueName) % CLAY_COUNTS[key]) + 1}.webp`
}
