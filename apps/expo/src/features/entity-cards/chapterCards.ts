// Which card a chapter offers, and which of them are new to the reader (ADR-0090). Shared by the
// native screens and the Bible DOM: no React Native import here.

import { getEntityCardId } from '~features/lexique/entityCards'
import {
  getEntityChapterStage,
  type EntityPortraitCatalog,
} from '~features/lexique/entityPortraits'

/** God's cards are in every collection from the start: never stored, never offered as new. */
export const GOD_ENTITY = 'LORD@Gen.1.1-Rev'

export const isCardAlwaysCollected = (cardId: string) =>
  cardId === GOD_ENTITY || cardId.startsWith(`${GOD_ENTITY}~`)

export const isCardCollected = (cardId: string, collected: Record<string, number>) =>
  isCardAlwaysCollected(cardId) || collected[cardId] !== undefined

/**
 * The card a chapter offers for an entity: the card of the life stage that covers the chapter,
 * the one its avatar shows, otherwise the base card. Nothing when neither is in the catalog.
 */
export const getChapterCardId = ({
  uniqueName,
  portraits,
  cardIds,
  book,
  chapter,
}: {
  uniqueName: string
  portraits: EntityPortraitCatalog | undefined
  cardIds: ReadonlySet<string>
  book: number
  chapter: number
}) => {
  const entry = portraits?.entities[uniqueName]
  const stage = entry ? getEntityChapterStage(entry, book, chapter) : undefined
  const stageCard = stage ? getEntityCardId(uniqueName, stage.key) : undefined
  if (stageCard && cardIds.has(stageCard)) return stageCard
  return cardIds.has(uniqueName) ? uniqueName : undefined
}

/** The chapter's entities whose card the reader has not collected yet: unique name → card. */
export const getChapterNewCards = ({
  uniqueNames,
  portraits,
  cardIds,
  collected,
  book,
  chapter,
}: {
  uniqueNames: string[]
  portraits: EntityPortraitCatalog | undefined
  cardIds: ReadonlySet<string>
  collected: Record<string, number>
  book: number
  chapter: number
}): Record<string, string> =>
  Object.fromEntries(
    uniqueNames.flatMap(uniqueName => {
      const cardId = getChapterCardId({ uniqueName, portraits, cardIds, book, chapter })
      return cardId && !isCardCollected(cardId, collected) ? [[uniqueName, cardId]] : []
    })
  )
