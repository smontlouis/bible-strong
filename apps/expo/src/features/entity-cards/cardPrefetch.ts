// The pictures of the cards the reader may open next, loaded ahead into the cards' cache, so that
// moving through the album shows each card whole at once (ADR-0090).

import type { EntityCardView } from './cardCatalog'
import { loadCardFonts, loadCardPicture } from './cardResources'

export const prefetchCards = (cards: EntityCardView[]) => {
  void loadCardFonts()
  cards.forEach(card => {
    void loadCardPicture(card.picture)
    if (!card.scene && card.backdrop) void loadCardPicture(card.backdrop)
  })
}
