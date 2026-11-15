// On the Web the card is the atlas's CSS card: its pictures load as images of the page do, so
// they are asked for ahead from the browser's cache (ADR-0090).

import { Image } from 'expo-image'

import type { EntityCardView } from './cardCatalog'

export const prefetchCards = (cards: EntityCardView[]) => {
  const uris = cards.flatMap(card => [card.picture, ...(card.backdrop ? [card.backdrop] : [])])
  if (uris.length) void Image.prefetch(uris)
}
