/**
 * What the share image of a public page shows. The site signs it into the address of the
 * image; the image is drawn from that address alone. The site and this service share this
 * file and nothing else.
 */
export type ShareCardContent =
  | { kind: 'default'; language?: 'fr' | 'en' }
  | { kind: 'text'; kicker: string; chip?: string; text: string }
  | {
      kind: 'word'
      kicker: string
      chip: string
      original: string
      transliteration: string
      gloss: string
      facts?: string
    }
  | {
      kind: 'title'
      kicker?: string
      chip?: string
      title: string
      /** A chapter is named in very large type; a longer name steps down by itself. */
      large?: boolean
      /** One line of facts under the title. */
      facts?: string
      /** The first lines of what the page reads. */
      excerpt?: string
      /** The address of one picture. */
      picture?: string
      /** Six captioned pictures, in two rows of three, in the place of the single one. */
      pictures?: { src: string; caption: string }[]
      /** The pictures are cut out, and drawn over the ground of the atlas. */
      cutOut?: boolean
    }
  | {
      /** An entity of the atlas, beside its picture or its place on the map. */
      kind: 'entity'
      kicker: string
      chip: string
      title: string
      facts?: string
      excerpt?: string
      /**
       * A portrait or a clay figure, cut out over the ground of the atlas, or a painting that
       * covers it. An address on the site itself is read from the site's files.
       */
      picture?: string
      /** Where a place lies, in the units of the atlas map, with a few places around it named. */
      map?: { x: number; y: number; neighbours: [name: string, x: number, y: number][] }
    }

export const SHARE_CARD_KINDS: ReadonlySet<string> = new Set([
  'default',
  'text',
  'word',
  'title',
  'entity',
])

/** Where the images are served. */
export const SHARE_CARD_ORIGIN = 'https://cards.bible-strong.app'
/**
 * Part of every image address, and of its signature. Raising it gives every page a new
 * address, hence a new image: do it when the design changes, since networks keep the image
 * of an address for weeks.
 */
export const SHARE_CARD_DESIGN = 'v1'

export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const

/**
 * The address of a share image: the signed description of what it shows, or nothing for the
 * default card. A page whose content changes gets a new address, hence a new image.
 */
export const shareCardUrl = (signed?: string): string =>
  `${SHARE_CARD_ORIGIN}/${SHARE_CARD_DESIGN}${signed ? `/${signed}` : ''}`

/** A card that shows photographs is heavier and is delivered as a JPEG. */
export const shareCardHasPictures = (content: ShareCardContent): boolean =>
  (content.kind === 'title' && Boolean(content.picture || content.pictures?.length)) ||
  (content.kind === 'entity' && Boolean(content.picture || content.map))
