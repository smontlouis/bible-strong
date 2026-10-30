// The collectible cards of the entities (ADR-0090), as the atlas shows them on an entity's page
// (ADR-0091). The published catalog names each card's portrait by its entity and stage; the
// picture is read in the portrait catalog, the backdrop in its own folder.

import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'
import type { ResourceLanguage } from '../resources/publicSite'
import { entityPortraitUrl, type AtlasPortraitCatalog } from './atlasPortraits'

/** Where the cards are published; a development machine may set another (`ENTITY_CARD_BASE_URL`). */
export const ENTITY_CARD_BASE_URL = 'https://media.bible-strong.app/entity-cards'

type Both = { fr: string; en: string }

type CardText = {
  name: string
  title: string
  chaptersLabel: string
  series: string[]
  meaning: string
  firstMention: string
  brief: string
  typeLine: string
  era?: string
  roles?: string[]
}

export type CardFamily = 'divine' | 'human' | 'spirit' | 'idol'

/** A Strong number of a character, with the name it stands for in its own script. */
export type CardStrong = { code: string; original: string; script: string }

type PublishedCard = {
  id: string
  entity: string
  stage: string | null
  family: CardFamily
  /** The era in French, the same in both languages of the card: what the gallery groups by. */
  era?: string
  /** The rank of a life stage among its character's cards, the base card being 0. */
  stageIndex?: number
  scene: boolean
  backdrop: string | null
  fadeTop: boolean
  stageCount: number
  chapterCount: number
  strong: string
  /** Every Strong number of the character's names, `strong` first. */
  strongs?: CardStrong[]
  original: string
  script: string
  transliteration: string
  text: Record<ResourceLanguage, CardText>
  line: {
    kind: 'citation' | 'paraphrase' | 'verset'
    text: Both
    source: Both
    /** The verse of the sentence, in the numbering of each language's Bible. */
    ref?: string
    refEn?: string
  }
}

export type CardCatalog = { cards: PublishedCard[]; backdrops: Record<string, string> }

const FAMILIES: readonly string[] = ['divine', 'human', 'spirit', 'idol']
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isBoth = (value: unknown): value is Both =>
  isRecord(value) && typeof value.fr === 'string' && typeof value.en === 'string'
const isCardText = (value: unknown): value is CardText =>
  isRecord(value) &&
  ['name', 'title', 'chaptersLabel', 'meaning', 'firstMention', 'brief', 'typeLine'].every(
    key => typeof value[key] === 'string'
  ) &&
  Array.isArray(value.series)

const isCard = (value: unknown): value is PublishedCard =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.entity === 'string' &&
  (value.stage === null || typeof value.stage === 'string') &&
  FAMILIES.includes(String(value.family)) &&
  typeof value.scene === 'boolean' &&
  (value.backdrop === null || typeof value.backdrop === 'string') &&
  typeof value.stageCount === 'number' &&
  typeof value.chapterCount === 'number' &&
  typeof value.original === 'string' &&
  isRecord(value.text) &&
  isCardText(value.text.fr) &&
  isCardText(value.text.en) &&
  isRecord(value.line) &&
  isBoth(value.line.text) &&
  isBoth(value.line.source)

/** The well-formed cards of the published catalog and the hash of each backdrop. */
export const parseCardCatalog = (value: unknown): CardCatalog | undefined => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.cards)) return undefined
  const backdrops = isRecord(value.backdrops)
    ? Object.fromEntries(
        Object.entries(value.backdrops).flatMap(([key, entry]) =>
          isRecord(entry) && typeof entry.hash === 'string' ? [[key, entry.hash]] : []
        )
      )
    : {}
  return { cards: value.cards.filter(isCard), backdrops }
}

/** How a card shines, read from its family and whether its character has life stages. */
export type CardFinish = 'holo-reverse' | 'v' | 'glitter' | 'cosmos' | 'reverse'

const FAMILY_FINISHES: Record<CardFamily, CardFinish> = {
  divine: 'holo-reverse',
  human: 'glitter',
  spirit: 'cosmos',
  idol: 'reverse',
}

export const CARD_FAMILY_LABELS: Record<CardFamily, Both> = {
  divine: { fr: 'Dieu et Jésus', en: 'God and Jesus' },
  human: { fr: 'Humains', en: 'Humans' },
  spirit: { fr: 'Êtres spirituels', en: 'Spiritual beings' },
  idol: { fr: 'Dieux et idoles', en: 'Gods and idols' },
}

/** A card as the page draws it, in one language. */
export type AtlasCardView = {
  id: string
  family: CardFamily
  /** A human with life stages wears the emerald frame and the pastel bands. */
  stages: boolean
  finish: CardFinish
  fadeTop: boolean
  /** A whole painted scene (God's cards), or a cut-out person in front of a backdrop. */
  scene: boolean
  picture: string
  backdrop?: string
  original: string
  /** `he` or `grc`: the script of the original name. */
  script: string
  transliteration: string
  strong: string
  name: string
  title: string
  typeLine: string
  foot: string
  chapterCount: number
  meaning: string
  brief: string
  firstMention: string
  chaptersLabel: string
  series?: string
  paraphrase: boolean
  sentence: string
  source: string
}

/** The address of a backdrop at one of its widths (ADR-0090). */
export const entityBackdropUrl = (base: string, key: string, hash: string, width: 384 | 768) =>
  `${base}/backdrops/${encodeURIComponent(key)}/${hash}/w${width}.webp`

/** A card in the gallery of every card: what the page draws, and what it sorts and filters by. */
export type AtlasGalleryCard = AtlasCardView & {
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
): AtlasCardView | undefined => {
  const portrait = portraits.entities[card.entity]
  const hash = card.stage
    ? portrait?.stages.find(stage => stage.key === card.stage)?.hash
    : portrait?.hash
  if (!hash) return undefined
  const text = card.text[language]
  const backdropHash = card.backdrop ? cards.backdrops[card.backdrop] : undefined
  const stages = card.family === 'human' && card.stageCount > 1
  return {
    id: card.id,
    family: card.family,
    stages,
    finish: stages ? 'v' : FAMILY_FINISHES[card.family],
    fadeTop: card.fadeTop,
    scene: card.scene,
    picture: entityPortraitUrl(card.entity, hash, 'w768'),
    ...(card.backdrop && backdropHash
      ? { backdrop: entityBackdropUrl(base, card.backdrop, backdropHash, 768) }
      : {}),
    original: card.original,
    script: card.script === 'grc' ? 'grc' : 'he',
    transliteration: card.transliteration,
    strong: card.strong,
    name: text.name,
    title: text.title,
    typeLine: text.typeLine,
    foot: text.series[0] || text.chaptersLabel,
    chapterCount: card.chapterCount,
    meaning: text.meaning,
    brief: text.brief,
    firstMention: text.firstMention,
    chaptersLabel: text.chaptersLabel,
    ...(text.series[0] ? { series: text.series[0] } : {}),
    paraphrase: card.line.kind === 'paraphrase',
    sentence: card.line.text[language],
    source: card.line.source[language],
  }
}

/** The cards of an entity, base card first, each with its picture; a card without one is left out. */
export const atlasCardsOf = (
  uniqueName: string,
  cards: CardCatalog,
  portraits: AtlasPortraitCatalog,
  language: ResourceLanguage,
  base: string = ENTITY_CARD_BASE_URL
): AtlasCardView[] =>
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
