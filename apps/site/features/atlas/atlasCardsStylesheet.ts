import atlasCardsCss from '../../src/atlas-cards.css?url'

/**
 * The styles of the cards and the packs, kept out of the stylesheet of every page: only the
 * atlas draws them. The atlas home links them too, so that an entity opened from it has them
 * already.
 */
export const ATLAS_CARDS_STYLESHEET = { rel: 'stylesheet', href: atlasCardsCss }

type Head = { links?: Record<string, unknown>[] } & Record<string, unknown>

export const withAtlasCardsStylesheet = <Value extends Head>(head: Value): Value => ({
  ...head,
  links: [...(head.links ?? []), ATLAS_CARDS_STYLESHEET],
})
