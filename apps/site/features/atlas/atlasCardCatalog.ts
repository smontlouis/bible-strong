// The collectible cards of the entities (ADR-0090), as the atlas shows them on an entity's page
// (ADR-0091). The published catalog names each card's portrait by its entity and stage; the
// picture is read in the portrait catalog, the backdrop in its own folder.

import {
  getCardView,
  type CardCatalog,
  type CardStrong,
  type CardView,
  type PublishedCard,
} from '@bible-strong/entity-cards'
import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'
import type { ResourceLanguage } from '../resources/publicSite'
import { entityPortraitUrl, type AtlasPortraitCatalog } from './atlasPortraits'

/** Where the cards are published; a development machine may set another (`ENTITY_CARD_BASE_URL`). */
export const ENTITY_CARD_BASE_URL = 'https://media.bible-strong.app/entity-cards'

// The model of a card and its catalog is shared with the application (ADR-0113).
export {
  CARD_FAMILY_LABELS,
  parseCardCatalog,
  type CardCatalog,
  type CardFamily,
} from '@bible-strong/entity-cards'

/** The address of a backdrop at one of its widths (ADR-0090). */
export const entityBackdropUrl = (base: string, key: string, hash: string, width: 384 | 768) =>
  `${base}/backdrops/${encodeURIComponent(key)}/${hash}/w${width}.webp`

/** A card in the gallery of every card: what the page draws, and what it sorts and filters by. */
export type AtlasGalleryCard = CardView & {
  entity: string
  stage?: string
  era: string
  /** The rank of the era in the story, gods and spiritual beings after it. */
  eraRank: number
  roles: string[]
  /** Every Strong number of the character's names. */
  strongs: CardStrong[]
  /** The ids of the series of the portraits' catalog the character belongs to. */
  seriesIds: string[]
  /** The order of the Bible: the character's first mention, then its stages. */
  order: number
  /** The first mention, `Gen.25.26`, and the verse of the card's sentence in the page's Bible. */
  firstRef?: string
  lineRef?: string
}

/** The eras of the cards in the order of the story; the beings and idols follow it. */
const ERA_ORDER = [
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
export const firstMentionOf = (uniqueName: string): string | undefined =>
  /@([1-4]?[A-Za-z]+\.\d+\.\d+)/u.exec(uniqueName)?.[1]

/** A rank of the order of the Bible: book, chapter and verse of a reference. */
const bibleRank = (reference: string | undefined) => {
  const [book, chapter, verse] = reference?.split('.') ?? []
  const index = (TIPNR_BOOK_CODES as readonly string[]).indexOf(book ?? '')
  return index < 0 ? 1e9 : (index + 1) * 1e6 + Number(chapter) * 1e3 + Number(verse)
}

/** A card as the page draws it, or nothing when its picture is not in the portraits' catalog. */
const cardView = (
  card: PublishedCard,
  cards: CardCatalog,
  portraits: AtlasPortraitCatalog,
  language: ResourceLanguage,
  base: string
): CardView | undefined =>
  getCardView(card, cards, language, {
    portraitHashOf: (entity, stage) => {
      const portrait = portraits.entities[entity]
      return stage ? portrait?.stages.find(item => item.key === stage)?.hash : portrait?.hash
    },
    pictureOf: (entity, hash) => entityPortraitUrl(entity, hash, 'w768'),
    backdropOf: (key, hash) => entityBackdropUrl(base, key, hash, 768),
  })

/** The cards of an entity, base card first, each with its picture; a card without one is left out. */
export const atlasCardsOf = (
  uniqueName: string,
  cards: CardCatalog,
  portraits: AtlasPortraitCatalog,
  language: ResourceLanguage,
  base: string = ENTITY_CARD_BASE_URL
): CardView[] =>
  cards.cards.flatMap(card => {
    const view =
      card.entity === uniqueName ? cardView(card, cards, portraits, language, base) : undefined
    return view ? [view] : []
  })

/** Every card with its picture, in the order of the Bible. */
export const atlasGalleryCards = (
  cards: CardCatalog,
  portraits: AtlasPortraitCatalog,
  language: ResourceLanguage,
  base: string = ENTITY_CARD_BASE_URL
): AtlasGalleryCard[] =>
  cards.cards
    .flatMap(card => {
      const view = cardView(card, cards, portraits, language, base)
      if (!view) return []
      const text = card.text[language]
      const era = text.era || card.era || ''
      const eraRank = ERA_ORDER.indexOf(card.era ?? '')
      const firstRef = firstMentionOf(card.entity)
      const lineRef = language === 'en' ? (card.line.refEn ?? card.line.ref) : card.line.ref
      return [
        {
          ...view,
          entity: card.entity,
          ...(card.stage ? { stage: card.stage } : {}),
          era,
          eraRank: eraRank < 0 ? ERA_ORDER.length : eraRank,
          roles: text.roles ?? [],
          strongs:
            card.strongs ??
            (card.strong
              ? [{ code: card.strong, original: card.original, script: card.script }]
              : []),
          seriesIds: portraits.series
            .filter(series => series.members.includes(card.entity))
            .map(series => series.id),
          // The stages of a character follow its base card.
          order: bibleRank(firstRef) * 10 + (card.stageIndex ?? 0),
          ...(firstRef ? { firstRef } : {}),
          ...(lineRef ? { lineRef } : {}),
        },
      ]
    })
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    .map((card, index) => ({ ...card, order: index }))
