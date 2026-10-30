import type {
  StrongLexiconEntitiesResponseDto,
  StrongLexiconEntityPassagesResponseDto,
  StrongLexiconEntityResponseDto,
} from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import {
  TIPNR_BOOK_CODES,
  type StrongLexiconListedEntity,
} from '@bible-strong/resource-domain/strong-lexicon'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { bibleBookName } from '../bible/bibleBooks'
import { buildBibleReferencePath } from '../resources/editorialLinks'
import { createPageReads } from '../resources/pageReads'
import { isResourceLanguage, type ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { notingStaleAnswers } from '../resources/staleAnswers'
import { buildStrongPath, displayStrongCode, parseStrongCode } from '../strong/strongRoutes'
import {
  atlasCardsOf,
  atlasGalleryCards,
  ENTITY_CARD_BASE_URL,
  parseCardCatalog,
  type AtlasCardView,
  type AtlasGalleryCard,
  type CardCatalog,
} from './atlasCardCatalog'
import { projectAtlasPlace } from './atlasProjection'
import {
  ENTITY_PORTRAIT_CATALOG_URL,
  entityClayUrl,
  entityPortraitUrl,
  parseAtlasPortraitCatalog,
  type AtlasChapterRange,
  type AtlasPortraitCatalog,
} from './atlasPortraits'
import {
  ATLAS_FAMILIES,
  atlasFamilyOf,
  buildAtlasEntityPath,
  isAtlasFamily,
  type AtlasFamily,
} from './atlasRoutes'

const CACHE_TTL_MS = 60 * 60 * 1000
const CATALOG_TIMEOUT_MS = 5_000
const ABSENT_CATALOG_TTL_MS = 5 * 60 * 1000
/** The entities of a family a page names beside its painted ones, the most named first. */
const MOST_NAMED_COUNT = 120
const SEARCH_RESULTS = 24

// ---------- What the pages are made of ----------

/** An entity as a tile shows it: its name, a line on it and its picture. */
export type AtlasTile = {
  uniqueName: string
  name: string
  brief: string
  /** The portrait, cut out over the ground, or the clay figure. */
  picture: string
  painted: boolean
  chapterCount: number
}

/** A place on the map: name, unique name, position, chapters and, when painted, its thumbnail. */
export type AtlasMapPoint =
  | [name: string, uniqueName: string, x: number, y: number, chapterCount: number]
  | [name: string, uniqueName: string, x: number, y: number, chapterCount: number, picture: string]

export type AtlasHomePageData = {
  language: ResourceLanguage
  entityCount: number
  counts: Record<AtlasFamily, number>
  series: { id: string; title: string; members: AtlasTile[] }[]
  places: AtlasTile[]
  beings: AtlasTile[]
  points: AtlasMapPoint[]
  incomplete: boolean
}

export type AtlasFamilyPageData = {
  language: ResourceLanguage
  family: AtlasFamily
  count: number
  painted: AtlasTile[]
  mostNamed: AtlasTile[]
  points: AtlasMapPoint[]
  incomplete: boolean
}

/** Every card, in the order of the Bible, with the series they can be filtered by. */
export type AtlasCardsPageData = {
  language: ResourceLanguage
  cards: AtlasGalleryCard[]
  /** The series that hold cards, in the order of the story. */
  series: { id: string; title: string }[]
  incomplete: boolean
}

/** One card, opened over the gallery at its own address. */
export type AtlasCardPageData = {
  language: ResourceLanguage
  card: AtlasGalleryCard
  incomplete: boolean
}

export type AtlasRelation = {
  name: string
  /** The page of the related entity, when the publication knows it. */
  path?: string
  picture: string
  uncertain: boolean
}

export type AtlasPassageBook = {
  book: number
  name: string
  chapters: { chapter: number; verses: number[]; path?: string }[]
}

export type AtlasStageView = {
  key: string
  label: string
  picture: string
  thumbnail: string
  chapters: string
}

export type AtlasEntityPageData = {
  language: ResourceLanguage
  uniqueName: string
  name: string
  family: AtlasFamily
  type: string
  brief: string
  /** The portrait's title (« Le berger de Bethléhem »), when it has one. */
  title?: string
  paragraphs: string[]
  picture: string
  thumbnail: string
  painted: boolean
  stagesLabel?: string
  stages: AtlasStageView[]
  cards: AtlasCardView[]
  roles: string[]
  series?: { title: string; rank: number; total: number; members: AtlasTile[] }
  strong: { code: string; label: string; path: string }[]
  relations: { kind: string; items: AtlasRelation[] }[]
  passages: AtlasPassageBook[]
  chapterCount: number
  verseCount: number
  place?: { area: string; latitude?: number; longitude?: number; mapUrl?: string }
  point?: AtlasMapPoint
  /** Places on the map around it, for its own map. */
  neighbours: AtlasMapPoint[]
  incomplete: boolean
}

// ---------- Reads, kept an hour by a server instance ----------

const entitiesCache = new Map<
  ResourceLanguage,
  { at: number; entities: StrongLexiconListedEntity[] }
>()

/** Every entity of the publication in a language. A STALE answer is not kept. */
export const listAtlasEntities = async (
  language: ResourceLanguage
): Promise<StrongLexiconListedEntity[]> => {
  const cached = entitiesCache.get(language)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.entities
  const { value: response, stale } = await notingStaleAnswers(() =>
    readResource<StrongLexiconEntitiesResponseDto>('/v1/strong-lexicon/entities', { language })
  )
  const entities = [...(response?.entities ?? [])]
  if (response && !stale) entitiesCache.set(language, { at: Date.now(), entities })
  return entities
}

let catalogCache: { at: number; catalog: AtlasPortraitCatalog } | undefined

/** The portrait catalog of the media host; nothing when it cannot be read. */
export const readAtlasPortraitCatalog = async (): Promise<AtlasPortraitCatalog | undefined> => {
  if (catalogCache && Date.now() - catalogCache.at < CACHE_TTL_MS) return catalogCache.catalog
  const response = await fetch(ENTITY_PORTRAIT_CATALOG_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Portrait catalog responded ${response.status}`)
  const catalog = parseAtlasPortraitCatalog(await response.json())
  if (!catalog) throw new Error('Portrait catalog unreadable')
  catalogCache = { at: Date.now(), catalog }
  return catalog
}

const EMPTY_CATALOG: AtlasPortraitCatalog = { entities: {}, series: [], roles: {} }

const cardBaseUrl = () =>
  (process.env.ENTITY_CARD_BASE_URL ?? ENTITY_CARD_BASE_URL).replace(/\/+$/u, '')

let cardCache: { at: number; catalog: CardCatalog | undefined } | undefined

/**
 * The card catalog of the media host (ADR-0090). Until it is published there is none, which is
 * not a failure: the pages show no card.
 */
export const readAtlasCardCatalog = async (): Promise<CardCatalog | undefined> => {
  // A missing catalog is asked for again within minutes: once it is published, a page drawn
  // without its cards would otherwise be kept by the page cache for a month.
  const kept = cardCache?.catalog ? CACHE_TTL_MS : ABSENT_CATALOG_TTL_MS
  if (cardCache && Date.now() - cardCache.at < kept) return cardCache.catalog
  const response = await fetch(`${cardBaseUrl()}/catalog.json`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
  })
  if (response.status === 404) {
    cardCache = { at: Date.now(), catalog: undefined }
    return undefined
  }
  if (!response.ok) throw new Error(`Card catalog responded ${response.status}`)
  const catalog = parseCardCatalog(await response.json())
  if (!catalog) throw new Error('Card catalog unreadable')
  cardCache = { at: Date.now(), catalog }
  return catalog
}

// ---------- Shaping ----------

const tileOf = (
  entity: StrongLexiconListedEntity,
  catalog: AtlasPortraitCatalog,
  size: 'w256' | 'w768' = 'w256'
): AtlasTile => {
  const portrait = catalog.entities[entity.uniqueName]
  return {
    uniqueName: entity.uniqueName,
    name: entity.name,
    brief: entity.brief,
    picture: portrait
      ? entityPortraitUrl(entity.uniqueName, portrait.hash, size)
      : entityClayUrl(entity.category, entity.type, entity.uniqueName),
    painted: Boolean(portrait),
    chapterCount: entity.chapterCount,
  }
}

const pointOf = (
  entity: StrongLexiconListedEntity,
  catalog: AtlasPortraitCatalog
): AtlasMapPoint | undefined => {
  if (entity.latitude === undefined || entity.longitude === undefined) return undefined
  const at = projectAtlasPlace(entity.latitude, entity.longitude)
  if (!at) return undefined
  const portrait = catalog.entities[entity.uniqueName]
  return portrait
    ? [
        entity.name,
        entity.uniqueName,
        at[0],
        at[1],
        entity.chapterCount,
        entityPortraitUrl(entity.uniqueName, portrait.hash, 'w256'),
      ]
    : [entity.name, entity.uniqueName, at[0], at[1], entity.chapterCount]
}

const mostNamedFirst = (
  left: { chapterCount: number; name: string },
  right: { chapterCount: number; name: string }
) => right.chapterCount - left.chapterCount || left.name.localeCompare(right.name)

/** The places of the map, the most named drawn last so that they sit on top. */
const mapPoints = (entities: StrongLexiconListedEntity[], catalog: AtlasPortraitCatalog) =>
  entities
    .filter(entity => entity.category === 'place')
    .flatMap(entity => {
      // A point is a tuple: wrapped, so that `flatMap` does not spread it.
      const point = pointOf(entity, catalog)
      return point ? [point] : []
    })
    .sort((left, right) => left[4] - right[4])

/** Reads the list and the catalog of a page; a catalog that cannot be read leaves it incomplete. */
const readAtlasBasis = async (language: ResourceLanguage) => {
  const reads = createPageReads()
  const [entities, catalog] = await Promise.all([
    reads.queue(() => listAtlasEntities(language)),
    reads.optional(readAtlasPortraitCatalog),
  ])
  return { entities, catalog: catalog ?? EMPTY_CATALOG, incomplete: reads.incomplete }
}

const text = (value: { fr: string; en: string }, language: ResourceLanguage) => value[language]

const formatRanges = (ranges: AtlasChapterRange[], language: ResourceLanguage) =>
  ranges
    .map(range => {
      const book = bibleBookName(range.book, language)
      if (range.fromVerse !== undefined && range.toVerse !== undefined) {
        return `${book} ${range.from}:${range.fromVerse}–${range.toVerse}`
      }
      return range.from === range.to ? `${book} ${range.from}` : `${book} ${range.from}–${range.to}`
    })
    .join(' ; ')

// ---------- Pages ----------

export const loadAtlasHomePage = createServerFn({ method: 'GET' })
  .validator((data: { language: string }) => data)
  .handler(async ({ data }): Promise<AtlasHomePageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const language = data.language
    const { entities, catalog, incomplete } = await readAtlasBasis(language)
    if (!entities.length) throw notFound()
    const byName = new Map(entities.map(entity => [entity.uniqueName, entity]))
    const counts = Object.fromEntries(ATLAS_FAMILIES.map(family => [family, 0])) as Record<
      AtlasFamily,
      number
    >
    for (const entity of entities) counts[atlasFamilyOf(entity.category)] += 1
    const painted = (category: StrongLexiconListedEntity['category']) =>
      entities
        .filter(entity => entity.category === category && catalog.entities[entity.uniqueName])
        .sort(mostNamedFirst)
        .map(entity => tileOf(entity, catalog))

    return {
      language,
      entityCount: entities.length,
      counts,
      series: catalog.series.flatMap(series => {
        const members = series.members.flatMap(name => {
          const entity = byName.get(name)
          return entity && catalog.entities[name] ? [tileOf(entity, catalog)] : []
        })
        return members.length
          ? [{ id: series.id, title: text(series.title, language), members }]
          : []
      }),
      places: painted('place'),
      beings: painted('supernatural'),
      points: mapPoints(entities, catalog),
      incomplete,
    }
  })

export const loadAtlasFamilyPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; family: string }) => data)
  .handler(async ({ data }): Promise<AtlasFamilyPageData> => {
    if (!isResourceLanguage(data.language) || !isAtlasFamily(data.family)) throw notFound()
    const { language, family } = data
    const { entities, catalog, incomplete } = await readAtlasBasis(language)
    if (!entities.length) throw notFound()
    const members = entities
      .filter(entity => atlasFamilyOf(entity.category) === family)
      .sort(mostNamedFirst)
    return {
      language,
      family,
      count: members.length,
      painted: members
        .filter(entity => catalog.entities[entity.uniqueName])
        .map(entity => tileOf(entity, catalog)),
      mostNamed: members
        .filter(entity => !catalog.entities[entity.uniqueName])
        .slice(0, MOST_NAMED_COUNT)
        .map(entity => tileOf(entity, catalog)),
      points: family === 'places' ? mapPoints(entities, catalog) : [],
      incomplete,
    }
  })

/** The cards of the gallery, drawn once per catalog and language. */
const galleries = new Map<
  ResourceLanguage,
  { cards: CardCatalog; portraits: AtlasPortraitCatalog; gallery: AtlasGalleryCard[] }
>()

const galleryOf = (
  cards: CardCatalog,
  portraits: AtlasPortraitCatalog,
  language: ResourceLanguage
): AtlasGalleryCard[] => {
  const kept = galleries.get(language)
  if (kept && kept.cards === cards && kept.portraits === portraits) return kept.gallery
  const gallery = atlasGalleryCards(cards, portraits, language, cardBaseUrl())
  galleries.set(language, { cards, portraits, gallery })
  return gallery
}

/** Reads the two catalogs of the cards; one that cannot be read leaves the page incomplete. */
const readCardBasis = async () => {
  const reads = createPageReads()
  const [portraits, cards] = await Promise.all([
    reads.optional(readAtlasPortraitCatalog),
    reads.optional(readAtlasCardCatalog),
  ])
  return { portraits, cards, incomplete: reads.incomplete }
}

export const loadAtlasCardsPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string }) => data)
  .handler(async ({ data }): Promise<AtlasCardsPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const { language } = data
    const { portraits, cards, incomplete } = await readCardBasis()
    const gallery = cards && portraits ? galleryOf(cards, portraits, language) : []
    const held = new Set(gallery.flatMap(card => card.seriesIds))
    return {
      language,
      cards: gallery,
      series: (portraits?.series ?? [])
        .filter(series => held.has(series.id))
        .map(series => ({ id: series.id, title: text(series.title, language) })),
      incomplete: incomplete || !gallery.length,
    }
  })

export const loadAtlasCardPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; id: string }) => data)
  .handler(async ({ data }): Promise<AtlasCardPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const { language, id } = data
    const { portraits, cards, incomplete } = await readCardBasis()
    const card =
      cards && portraits
        ? galleryOf(cards, portraits, language).find(item => item.id === id)
        : undefined
    if (!card) {
      // A card is missing for good only when both catalogs were read.
      if (cards && portraits) throw notFound()
      throw new Error('ATLAS_CARD_CATALOG_UNREADABLE')
    }
    return { language, card, incomplete }
  })

// Search ignores case, accents and the underscores of the publication.
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[_\s]+/gu, ' ')
    .toLowerCase()
    .trim()

/** The entities whose name starts with, then holds, what the reader typed; the most named first. */
export const searchAtlas = createServerFn({ method: 'GET' })
  .validator((data: { language: string; query: string }) => data)
  .handler(async ({ data }): Promise<AtlasTile[]> => {
    if (!isResourceLanguage(data.language)) return []
    const query = fold(data.query.slice(0, 60))
    if (query.length < 2) return []
    const { entities, catalog } = await readAtlasBasis(data.language)
    const scored = entities.flatMap(entity => {
      const name = fold(entity.name)
      const rank = name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : -1
      return rank < 0 ? [] : [{ entity, rank }]
    })
    return scored
      .sort((left, right) => left.rank - right.rank || mostNamedFirst(left.entity, right.entity))
      .slice(0, SEARCH_RESULTS)
      .map(({ entity }) => tileOf(entity, catalog))
  })

const RELATION_ORDER = [
  'father',
  'mother',
  'partner',
  'sibling',
  'offspring',
  'founder_or_origin',
  'resident',
]

export const loadAtlasEntityPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; uniqueName: string }) => data)
  .handler(async ({ data }): Promise<AtlasEntityPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const { language, uniqueName } = data
    const reads = createPageReads()
    const [response, passages, entities, catalog, cardCatalog] = await Promise.all([
      reads.queue(() =>
        readResource<StrongLexiconEntityResponseDto>(
          `/v1/strong-lexicon/entities/${encodeURIComponent(uniqueName)}`,
          { language }
        )
      ),
      reads.optional(() =>
        readResource<StrongLexiconEntityPassagesResponseDto>(
          `/v1/strong-lexicon/entities/${encodeURIComponent(uniqueName)}/passages`
        )
      ),
      reads.optional(() => listAtlasEntities(language)),
      reads.optional(readAtlasPortraitCatalog),
      reads.optional(readAtlasCardCatalog),
    ])
    const entity = response?.entity
    if (!entity) throw notFound()
    const portraits = catalog ?? EMPTY_CATALOG
    const listed = new Map((entities ?? []).map(item => [item.uniqueName, item]))
    const self = listed.get(uniqueName)
    const portrait = portraits.entities[uniqueName]
    const category =
      self?.category ??
      (entity.type.toLowerCase() === 'supernatural'
        ? 'supernatural'
        : (entity.category as StrongLexiconListedEntity['category']))
    const clay = entityClayUrl(category, entity.type, uniqueName)

    // Relations, grouped by kind; a related entity takes its own picture.
    const groups = new Map<string, AtlasRelation[]>()
    for (const relation of entity.relations) {
      const target = relation.targetUniqueName ? listed.get(relation.targetUniqueName) : undefined
      const items = groups.get(relation.relation) ?? []
      items.push({
        name: target?.name ?? relation.targetName,
        ...(relation.targetUniqueName
          ? { path: buildAtlasEntityPath(language, relation.targetUniqueName) }
          : {}),
        picture: target
          ? tileOf(target, portraits).picture
          : entityClayUrl(
              relation.targetCategory ?? 'other',
              relation.targetType ?? '',
              relation.targetUniqueName ?? relation.targetName
            ),
        uncertain: relation.certainty === 'uncertain',
      })
      groups.set(relation.relation, items)
    }
    const relations = [...groups.entries()]
      .sort(([left], [right]) => {
        const order = (kind: string) =>
          RELATION_ORDER.includes(kind) ? RELATION_ORDER.indexOf(kind) : RELATION_ORDER.length
        return order(left) - order(right)
      })
      .map(([kind, items]) => ({ kind, items }))

    // Passages, book by book, each chapter linked to the Bible of the page.
    const books: AtlasPassageBook[] = []
    let verseCount = 0
    for (const passage of passages?.passages ?? []) {
      const book = (TIPNR_BOOK_CODES as readonly string[]).indexOf(passage.book) + 1
      if (book < 1) continue
      verseCount += passage.verses.length
      const chapter = {
        chapter: passage.chapter,
        verses: [...passage.verses],
        path: buildBibleReferencePath(language, {
          book,
          chapter: passage.chapter,
          ...(passage.verses.length ? { verse: passage.verses[0] } : {}),
        }),
      }
      const current = books.at(-1)
      if (current?.book === book) current.chapters.push(chapter)
      else books.push({ book, name: bibleBookName(book, language), chapters: [chapter] })
    }

    const series = portraits.series.find(item => item.members.includes(uniqueName))
    const point = self ? pointOf(self, portraits) : undefined
    const neighbours = point
      ? mapPoints(entities ?? [], portraits).filter(
          other =>
            other[1] !== uniqueName && Math.hypot(other[2] - point[2], other[3] - point[3]) < 220
        )
      : []

    return {
      language,
      uniqueName,
      name: entity.name,
      family: atlasFamilyOf(category),
      type: entity.type,
      brief: entity.brief,
      ...(portrait?.title ? { title: text(portrait.title, language) } : {}),
      paragraphs: entity.articleHtml
        .split('¶')
        .map(paragraph => paragraph.replace(/\s+/gu, ' ').trim())
        .filter(Boolean),
      picture: portrait ? entityPortraitUrl(uniqueName, portrait.hash, 'w768') : clay,
      thumbnail: portrait ? entityPortraitUrl(uniqueName, portrait.hash, 'w256') : clay,
      painted: Boolean(portrait),
      ...(portrait?.stagesLabel ? { stagesLabel: text(portrait.stagesLabel, language) } : {}),
      stages: (portrait?.stages ?? []).map(stage => ({
        key: stage.key,
        label: text(stage.label, language),
        picture: entityPortraitUrl(uniqueName, stage.hash, 'w768'),
        thumbnail: entityPortraitUrl(uniqueName, stage.hash, 'w256'),
        chapters: formatRanges(stage.ranges, language),
      })),
      cards: cardCatalog
        ? atlasCardsOf(uniqueName, cardCatalog, portraits, language, cardBaseUrl())
        : [],
      roles: (portrait?.roles ?? []).flatMap(role =>
        portraits.roles[role] ? [text(portraits.roles[role], language)] : []
      ),
      ...(series
        ? {
            series: {
              title: text(series.title, language),
              rank: series.members.indexOf(uniqueName) + 1,
              total: series.members.length,
              members: series.members.flatMap(name => {
                const member = listed.get(name)
                return member ? [tileOf(member, portraits)] : []
              }),
            },
          }
        : {}),
      strong: entity.strongCodes.flatMap(code => {
        const identity = parseStrongCode(code)
        return identity
          ? [
              {
                code: identity.code,
                label: displayStrongCode(identity.code),
                path: buildStrongPath(language, identity.code),
              },
            ]
          : []
      }),
      relations,
      passages: books,
      chapterCount: books.reduce((total, book) => total + book.chapters.length, 0),
      verseCount,
      ...(entity.place
        ? {
            place: {
              area: entity.place.area,
              ...(entity.place.latitude && entity.place.longitude
                ? { latitude: entity.place.latitude, longitude: entity.place.longitude }
                : {}),
              ...(entity.place.palopenmapsUrl && entity.place.latitude
                ? { mapUrl: entity.place.palopenmapsUrl }
                : {}),
            },
          }
        : {}),
      ...(point ? { point } : {}),
      neighbours,
      incomplete: reads.incomplete,
    }
  })
