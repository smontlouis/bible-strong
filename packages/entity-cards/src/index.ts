// The collectible cards of the entities (ADR-0090): the published catalog and the view each face
// of a card draws, for the atlas (ADR-0092), the application's Web (CSS) and its Skia card
// (ADR-0113). The catalog names each card's portrait by its entity and stage: the caller says
// where that picture and the card's backdrop are served.

export type CardLanguage = 'fr' | 'en'
export type Both = { fr: string; en: string }

export type CardText = {
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

/** How a card shines, read from its family and whether its character has life stages. */
export type CardFinish = 'holo-reverse' | 'v' | 'glitter' | 'cosmos' | 'reverse'

/** A Strong number of a character, with the name it stands for in its own script. */
export type CardStrong = { code: string; original: string; script: string }

export type PublishedCard = {
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
  text: Record<CardLanguage, CardText>
  line: {
    kind: 'citation' | 'paraphrase' | 'verset'
    text: Both
    source: Both
    /** The verse of the sentence, in the numbering of each language's Bible. */
    ref?: string
    refEn?: string
  }
}

/** The cards of the published catalog, and the hash of each backdrop by its key. */
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

const FAMILY_FINISHES: Record<CardFamily, CardFinish> = {
  divine: 'holo-reverse',
  human: 'glitter',
  spirit: 'cosmos',
  idol: 'reverse',
}

/** A human with life stages wears the emerald frame and the pastel bands. */
export const hasLifeStages = (card: Pick<PublishedCard, 'family' | 'stageCount'>) =>
  card.family === 'human' && card.stageCount > 1

export const getCardFinish = (card: Pick<PublishedCard, 'family' | 'stageCount'>): CardFinish =>
  hasLifeStages(card) ? 'v' : FAMILY_FINISHES[card.family]

export const CARD_FAMILY_LABELS: Record<CardFamily, Both> = {
  divine: { fr: 'Dieu et Jésus', en: 'God and Jesus' },
  human: { fr: 'Humains', en: 'Humans' },
  spirit: { fr: 'Êtres spirituels', en: 'Spiritual beings' },
  idol: { fr: 'Dieux et idoles', en: 'Gods and idols' },
}

/** The words around and on a card, in both languages. */
export const CARD_WORDS = {
  fr: {
    open: 'Ouvrir la carte',
    flip: 'Verso',
    front: 'Recto',
    close: 'Fermer',
    thisCard: 'Cette carte',
    first: 'Première mention',
    appears: 'Apparaît dans',
    chapters: (count: number) => (count > 1 ? `${count} chapitres` : 'un seul chapitre'),
    series: 'Série',
    rank: (rank: number, total: number) => `Carte ${rank} sur ${total}`,
  },
  en: {
    open: 'Open the card',
    flip: 'Back',
    front: 'Front',
    close: 'Close',
    thisCard: 'This card',
    first: 'First mention',
    appears: 'Appears in',
    chapters: (count: number) => (count > 1 ? `${count} chapters` : 'one chapter'),
    series: 'Series',
    rank: (rank: number, total: number) => `Card ${rank} of ${total}`,
  },
} as const

/** A card as its faces draw it, in one language. */
export type CardView = {
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
  script: 'he' | 'grc'
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

/** The hash of a card's portrait in the portraits' catalog: its stage's, or its character's. */
export type PortraitHashOf = (entity: string, stage: string | null) => string | undefined

/**
 * A card as its faces draw it, or nothing when its picture is not published. `pictureOf` and
 * `backdropOf` give the addresses of the portrait and of the painted backdrop.
 */
export const getCardView = (
  card: PublishedCard,
  catalog: CardCatalog,
  language: CardLanguage,
  {
    portraitHashOf,
    pictureOf,
    backdropOf,
  }: {
    portraitHashOf: PortraitHashOf
    pictureOf: (entity: string, hash: string) => string
    backdropOf: (key: string, hash: string) => string
  }
): CardView | undefined => {
  const hash = portraitHashOf(card.entity, card.stage)
  if (!hash) return undefined
  const text = card.text[language]
  const backdropHash = card.backdrop ? catalog.backdrops[card.backdrop] : undefined
  return {
    id: card.id,
    family: card.family,
    stages: hasLifeStages(card),
    finish: getCardFinish(card),
    fadeTop: card.fadeTop,
    scene: card.scene,
    picture: pictureOf(card.entity, hash),
    ...(card.backdrop && backdropHash ? { backdrop: backdropOf(card.backdrop, backdropHash) } : {}),
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

/** A card's place among its character's cards, the base card first, from 1. */
export const getCardRank = (card: PublishedCard, catalog: CardCatalog) => {
  const siblings = catalog.cards
    .filter(other => other.entity === card.entity)
    .sort((a, b) => (a.stageIndex ?? 0) - (b.stageIndex ?? 0))
  return { rank: siblings.findIndex(other => other.id === card.id) + 1, total: siblings.length }
}
