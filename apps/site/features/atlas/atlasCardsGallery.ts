import type { AtlasGalleryCard, CardFamily } from './atlasCardCatalog'

// What the gallery of cards does with them: search, filters, order, and the packs drawn at random.
// Nothing here is kept: the filters live in the address's fragment, a pack in the page.

export const CARD_SORTS = ['bible', 'name', 'named'] as const
export type CardSort = (typeof CARD_SORTS)[number]

export const CARD_FAMILIES: readonly CardFamily[] = ['divine', 'human', 'spirit', 'idol']

export type CardFilters = {
  query: string
  family?: CardFamily
  /** The rank of an era (`AtlasGalleryCard.eraRank`). */
  era?: number
  series?: string
  role?: string
  /** Only the cards of the characters who have life stages. */
  stages: boolean
  sort: CardSort
}

export const NO_FILTERS: CardFilters = { query: '', stages: false, sort: 'bible' }

export const filtersAreSet = (filters: CardFilters) =>
  Boolean(
    filters.query.trim() ||
    filters.family ||
    filters.era !== undefined ||
    filters.series ||
    filters.role ||
    filters.stages
  )

/** Case, accents, the points of Hebrew and Greek, and punctuation set aside. */
export const foldCardText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’'_\-–—.,;:]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .toLowerCase()
    .trim()

const searchText = new WeakMap<AtlasGalleryCard, string>()

const textOf = (card: AtlasGalleryCard) => {
  let text = searchText.get(card)
  if (text === undefined) {
    text = foldCardText(
      [
        card.name,
        card.title,
        card.original,
        card.transliteration,
        // Every number of the character; `H1732` is also found as `1732`.
        ...card.strongs.flatMap(strong => [
          strong.code,
          strong.code.replace(/^[HG]/u, ''),
          strong.original,
        ]),
        card.era,
        ...card.roles,
        card.series ?? '',
      ].join(' | ')
    )
    searchText.set(card, text)
  }
  return text
}

/** A card holds every word of the query, at the start of one of its words. */
export const cardMatches = (card: AtlasGalleryCard, query: string) => {
  const words = foldCardText(query).split(' ').filter(Boolean)
  if (!words.length) return true
  const text = ` ${textOf(card)}`
  return words.every(word => text.includes(` ${word}`) || text.includes(`|${word}`))
}

const SORTS: Record<CardSort, (left: AtlasGalleryCard, right: AtlasGalleryCard) => number> = {
  bible: (left, right) => left.order - right.order,
  name: (left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
    left.order - right.order,
  // The stages of a character stay together, behind its base card.
  named: (left, right) => right.chapterCount - left.chapterCount || left.order - right.order,
}

export const filterCards = (cards: AtlasGalleryCard[], filters: CardFilters) =>
  cards
    .filter(
      card =>
        (!filters.family || card.family === filters.family) &&
        (filters.era === undefined || card.eraRank === filters.era) &&
        (!filters.series || card.seriesIds.includes(filters.series)) &&
        (!filters.role || card.roles.includes(filters.role)) &&
        (!filters.stages || card.stages) &&
        cardMatches(card, filters.query)
    )
    .sort(SORTS[filters.sort])

/** The cards grouped by era, in the order of the Bible: the gallery's sections. */
export const cardsByEra = (cards: AtlasGalleryCard[]) => {
  const groups: { era: string; eraRank: number; cards: AtlasGalleryCard[] }[] = []
  for (const card of [...cards].sort(
    (left, right) => left.eraRank - right.eraRank || left.order - right.order
  )) {
    const last = groups.at(-1)
    if (last?.eraRank === card.eraRank) last.cards.push(card)
    else groups.push({ era: card.era, eraRank: card.eraRank, cards: [card] })
  }
  return groups
}

/** What a filter can take, with the number of cards that take it, the most common first. */
export const countValues = (values: string[]) =>
  [
    ...values.reduce(
      (counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
      new Map<string, number>()
    ),
  ]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))

// ---------- The address ----------

/** The filters as the fragment of the address writes them, so that a filtered view can be shared. */
export const writeCardFilters = (filters: CardFilters) => {
  const parameters = new URLSearchParams()
  if (filters.query.trim()) parameters.set('q', filters.query.trim())
  if (filters.family) parameters.set('family', filters.family)
  if (filters.era !== undefined) parameters.set('era', String(filters.era))
  if (filters.series) parameters.set('series', filters.series)
  if (filters.role) parameters.set('role', filters.role)
  if (filters.stages) parameters.set('stages', '1')
  if (filters.sort !== 'bible') parameters.set('sort', filters.sort)
  const fragment = parameters.toString()
  return fragment ? `#${fragment}` : ''
}

export const readCardFilters = (fragment: string): CardFilters => {
  const parameters = new URLSearchParams(fragment.replace(/^#/u, ''))
  const family = parameters.get('family')
  const era = Number(parameters.get('era') ?? Number.NaN)
  const sort = parameters.get('sort')
  return {
    query: parameters.get('q') ?? '',
    ...(family && (CARD_FAMILIES as readonly string[]).includes(family)
      ? { family: family as CardFamily }
      : {}),
    ...(Number.isInteger(era) && era >= 0 ? { era } : {}),
    ...(parameters.get('series') ? { series: parameters.get('series') ?? undefined } : {}),
    ...(parameters.get('role') ? { role: parameters.get('role') ?? undefined } : {}),
    stages: parameters.get('stages') === '1',
    sort: (CARD_SORTS as readonly string[]).includes(sort ?? '') ? (sort as CardSort) : 'bible',
  }
}

// ---------- Packs ----------

export const PACK_SIZE = 5

/** A pack: every card, or the cards of one era. */
export type CardPack = {
  id: string
  era?: number
  title: string
  count: number
  cover: AtlasGalleryCard[]
}

export const cardPacks = (cards: AtlasGalleryCard[], everything: string): CardPack[] => {
  const cover = (pool: AtlasGalleryCard[]) =>
    [...new Map(pool.filter(card => !card.scene).map(card => [card.entity, card])).values()]
      .sort((left, right) => right.chapterCount - left.chapterCount)
      .slice(0, 3)
  return [
    { id: 'all', title: everything, count: cards.length, cover: cover(cards) },
    ...cardsByEra(cards)
      .filter(group => new Set(group.cards.map(card => card.entity)).size >= PACK_SIZE)
      .map(group => ({
        id: `era-${group.eraRank}`,
        era: group.eraRank,
        title: group.era,
        count: group.cards.length,
        cover: cover(group.cards),
      })),
  ]
}

const shuffle = <T>(items: T[], random: () => number) => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

/**
 * Five cards of five characters, at random: two of the better known of the pack and three of the
 * others, so that a pack mixes Moses with Jael. No card is worth more than another (ADR-0090):
 * the mix is there for discovery. Cards seen earlier in the visit come back only once every card
 * of the pack has been drawn.
 */
export const drawPack = (
  pool: AtlasGalleryCard[],
  seen: ReadonlySet<string>,
  random: () => number = Math.random
): AtlasGalleryCard[] => {
  const fresh = pool.filter(card => !seen.has(card.id))
  const candidates = new Set(fresh.map(card => card.entity)).size >= PACK_SIZE ? fresh : pool
  const counts = candidates.map(card => card.chapterCount).sort((left, right) => left - right)
  const median = counts[Math.floor(counts.length / 2)] ?? 0
  const known = shuffle(
    candidates.filter(card => card.chapterCount >= median),
    random
  )
  const others = shuffle(
    candidates.filter(card => card.chapterCount < median),
    random
  )
  const drawn: AtlasGalleryCard[] = []
  const entities = new Set<string>()
  const take = (from: AtlasGalleryCard[], count: number) => {
    for (const card of from) {
      if (drawn.length === PACK_SIZE || count === 0) return
      if (entities.has(card.entity)) continue
      entities.add(card.entity)
      drawn.push(card)
      count -= 1
    }
  }
  take(known, 2)
  take(others, PACK_SIZE - drawn.length)
  take(known, PACK_SIZE - drawn.length)
  return shuffle(drawn, random)
}
