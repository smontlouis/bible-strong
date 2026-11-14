// The album of the collectible cards (ADR-0090): every card of the catalog in the order of the
// Bible, grouped by era, with what the reader has collected. Shared by the native screens and the
// Web: no React Native import here.

import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'

import type { CardCatalog, CardLanguage, PublishedCard } from './cardCatalog'
import { GOD_ENTITY, isCardCollected } from './chapterCards'

/** The eras of the cards in the order of the story; the beings and idols follow it. */
export const CARD_ERA_ORDER = [
  'Origines',
  'Patriarches',
  'Exode',
  'Juges et royauté',
  'Prophètes et exil',
  'Nouveau Testament',
  'Êtres spirituels',
  'Créatures',
  'Dieux et idoles',
]

/** `Gen.25.26`, the first mention a unique name opens on (`Israel@Gen.25.26-Rev`). */
export const getFirstMention = (uniqueName: string): string | undefined =>
  /@([1-4]?[A-Za-z]+\.\d+\.\d+)/u.exec(uniqueName)?.[1]

/** A rank of the order of the Bible: book, chapter and verse of a reference. */
const bibleRank = (reference: string | undefined) => {
  const [book, chapter, verse] = reference?.split('.') ?? []
  const index = (TIPNR_BOOK_CODES as readonly string[]).indexOf(book ?? '')
  return index < 0 ? 1e9 : (index + 1) * 1e6 + Number(chapter) * 1e3 + Number(verse)
}

/** The cards in the order of the Bible: a character's first mention, then its life stages. */
export const sortCardsByBible = (cards: PublishedCard[]) =>
  [...cards].sort(
    (left, right) =>
      bibleRank(getFirstMention(left.entity)) * 10 +
        (left.stageIndex ?? 0) -
        (bibleRank(getFirstMention(right.entity)) * 10 + (right.stageIndex ?? 0)) ||
      left.id.localeCompare(right.id)
  )

/** The book where a card's character is first met, as the card names it: « Genèse 2:19 » → « Genèse ». */
export const getMeetingBook = (card: PublishedCard, language: CardLanguage) => {
  const mention = card.text[language].firstMention.trim()
  const book = mention.replace(/\s+\d+([:.,]\d+)*\s*$/u, '')
  return book || mention
}

export type CardAlbumFilter = 'all' | 'found' | 'missing'

export type CardAlbumEra = {
  /** The era as the catalog names it in French: the key of the group. */
  key: string
  title: string
  cards: PublishedCard[]
  found: number
  total: number
}

export type CardAlbum = {
  eras: CardAlbumEra[]
  /** The base cards: one per character. */
  characters: { found: number; total: number }
  /** The cards of the life stages. */
  stages: { found: number; total: number }
  found: number
  total: number
}

/** The key of the album's first group: God's cards, held by every reader from the start. */
export const GOD_GROUP = 'god'

/** Every card of the catalog grouped by era, God's first, with the counts the album shows. */
export const getCardAlbum = (
  catalog: CardCatalog,
  collected: Record<string, number>,
  language: CardLanguage,
  filter: CardAlbumFilter = 'all',
  /** A card the device can draw: its portrait is published. */
  isDrawable: (card: PublishedCard) => boolean = () => true,
  /** The title of God's group, in the language of the interface. */
  godTitle = 'Dieu'
): CardAlbum => {
  const cards = sortCardsByBible(catalog.cards.filter(isDrawable))
  const has = (card: PublishedCard) => isCardCollected(card.id, collected)
  const count = (list: PublishedCard[]) => ({
    found: list.filter(has).length,
    total: list.length,
  })

  const byEra = new Map<string, PublishedCard[]>()
  cards.forEach(card => {
    const key = card.entity === GOD_ENTITY ? GOD_GROUP : (card.era ?? '')
    byEra.set(key, [...(byEra.get(key) ?? []), card])
  })
  const rank = (key: string) => {
    if (key === GOD_GROUP) return -1
    const index = CARD_ERA_ORDER.indexOf(key)
    return index < 0 ? CARD_ERA_ORDER.length : index
  }
  const eras = [...byEra.entries()]
    .sort(([left], [right]) => rank(left) - rank(right))
    .map(([key, list]) => ({
      key,
      title: key === GOD_GROUP ? godTitle : list[0]?.text[language].era || key,
      cards: list.filter(card =>
        filter === 'all' ? true : filter === 'found' ? has(card) : !has(card)
      ),
      ...count(list),
    }))
    .filter(era => era.cards.length > 0)

  return {
    eras,
    characters: count(cards.filter(card => !card.stage)),
    stages: count(cards.filter(card => !!card.stage)),
    ...count(cards),
  }
}

/** The cards collected last, newest first: what the home shows of the album. */
export const getLatestCollected = (
  catalog: CardCatalog,
  collected: Record<string, number>,
  limit: number
) =>
  catalog.cards
    .filter(card => collected[card.id] !== undefined)
    .sort((left, right) => collected[right.id] - collected[left.id])
    .slice(0, limit)
