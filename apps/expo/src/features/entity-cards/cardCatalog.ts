// The collectible cards of the entities (ADR-0090) as the application draws them. The model of a
// card and its catalog is shared with the atlas (ADR-0113); the application says where its
// pictures are served and where a card stands among its character's cards.

import {
  getCardRank,
  getCardView,
  type CardCatalog,
  type CardLanguage,
  type CardView,
  type PublishedCard,
} from '@bible-strong/entity-cards'

import { ENTITY_CARD_BASE_URL, type EntityCardBackdropSize } from '~features/lexique/entityCards'
import {
  getEntityPortraitUri,
  type EntityPortraitCatalog,
  type EntityPortraitSize,
} from '~features/lexique/entityPortraits'

export {
  CARD_FAMILY_LABELS,
  CARD_WORDS,
  parseCardCatalog,
  type CardCatalog,
  type CardFamily,
  type CardFinish,
  type CardLanguage,
  type PublishedCard,
} from '@bible-strong/entity-cards'

/** A card as the application draws it, in one language: both faces and their pictures. */
export type EntityCardView = CardView & {
  language: CardLanguage
  /** The card's place among its character's cards, the base card first. */
  rank: number
  total: number
}

export const getCardBackdropUri = (
  key: string,
  hash: string,
  size: EntityCardBackdropSize = 'w768'
) => `${ENTITY_CARD_BASE_URL}/backdrops/${encodeURIComponent(key)}/${hash}/${size}.webp`

/** A card as drawn, or nothing when its picture is not in the portraits' catalog. */
export const getEntityCardView = (
  card: PublishedCard,
  catalog: CardCatalog,
  portraits: EntityPortraitCatalog,
  language: CardLanguage,
  size: { portrait: EntityPortraitSize; backdrop: EntityCardBackdropSize } = {
    portrait: 'w768',
    backdrop: 'w768',
  }
): EntityCardView | undefined => {
  const view = getCardView(card, catalog, language, {
    portraitHashOf: (entity, stage) => {
      const portrait = portraits.entities[entity]
      return stage ? portrait?.stages?.find(item => item.key === stage)?.hash : portrait?.hash
    },
    pictureOf: (entity, hash) => getEntityPortraitUri(entity, hash, size.portrait),
    backdropOf: (key, hash) => getCardBackdropUri(key, hash, size.backdrop),
  })
  return view ? { ...view, language, ...getCardRank(card, catalog) } : undefined
}
