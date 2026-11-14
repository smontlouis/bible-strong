// Shared by the native screens and the Bible DOM: no React Native import here.

/** The collectible cards of the entities on the public media host (ADR-0090). */
export const ENTITY_CARD_BASE_URL = 'https://media.bible-strong.app/entity-cards'
export const ENTITY_CARD_CATALOG_URL = `${ENTITY_CARD_BASE_URL}/catalog.json`

/** 384 pixels wide for a small card, 768 for a large one; both 2:3. */
export type EntityCardBackdropSize = 'w384' | 'w768'

/**
 * What the application keeps of the card catalog: the painted backdrop of each card. A card is the
 * entity's unique name, or `<uniqueName>~<stageKey>` for a life stage.
 */
export type EntityCardCatalog = {
  /** Card → key of its backdrop. A card without one (God's) is absent. */
  cards: Record<string, string>
  /** Backdrop key → hash of its painting. */
  backdrops: Record<string, string>
}

const HASH_PATTERN = /^[0-9a-f]{6,64}$/
const KEY_PATTERN = /^[a-z0-9-]+$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Keeps the backdrops of a published catalog, or nothing when it is not one. */
export const parseEntityCardCatalog = (value: unknown): EntityCardCatalog | undefined => {
  if (!isRecord(value) || value.version !== 1) return undefined
  if (!Array.isArray(value.cards) || !isRecord(value.backdrops)) return undefined

  const backdrops = Object.fromEntries(
    Object.entries(value.backdrops).flatMap(([key, entry]) =>
      KEY_PATTERN.test(key) &&
      isRecord(entry) &&
      typeof entry.hash === 'string' &&
      HASH_PATTERN.test(entry.hash)
        ? [[key, entry.hash]]
        : []
    )
  )
  const cards = Object.fromEntries(
    value.cards.flatMap(card =>
      isRecord(card) &&
      typeof card.id === 'string' &&
      typeof card.backdrop === 'string' &&
      backdrops[card.backdrop]
        ? [[card.id, card.backdrop]]
        : []
    )
  )
  return { cards, backdrops }
}

export const getEntityCardId = (uniqueName: string, stageKey?: string) =>
  stageKey ? `${uniqueName}~${stageKey}` : uniqueName

/**
 * The painted backdrop of an entity's card, or of the card of one of its stages. A stage without a
 * card of its own takes its character's backdrop; an entity without a card has none.
 */
export const getEntityCardBackdropUri = (
  catalog: EntityCardCatalog | undefined,
  uniqueName: string,
  stageKey?: string,
  size: EntityCardBackdropSize = 'w768'
) => {
  if (!catalog) return undefined
  const key =
    catalog.cards[getEntityCardId(uniqueName, stageKey)] ?? catalog.cards[uniqueName] ?? undefined
  const hash = key ? catalog.backdrops[key] : undefined
  return key && hash
    ? `${ENTITY_CARD_BASE_URL}/backdrops/${encodeURIComponent(key)}/${hash}/${size}.webp`
    : undefined
}
