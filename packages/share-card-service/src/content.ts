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
    }

export const SHARE_CARD_KINDS: ReadonlySet<string> = new Set(['default', 'text', 'word', 'title'])

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
  content.kind === 'title' && Boolean(content.picture || content.pictures?.length)
