/**
 * What the share image of a public page shows. The site writes it in a meta element of each
 * page; this service reads it back from the rendered page and draws it. The two sides share
 * this file and nothing else.
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

/** The meta element in which a page says what its share image shows. */
export const SHARE_CARD_META = 'bible-strong:share-card'

/** Where the images are served, and the version of their design. */
export const SHARE_CARD_ORIGIN = 'https://cards.bible-strong.app'
/**
 * Part of every image address. Raising it gives every page a new address, hence a new image:
 * do it when the design changes, since networks keep the image of an address for weeks.
 */
export const SHARE_CARD_DESIGN = 'v1'

export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const

/** The address of the share image of the page at `path` (query string included). */
export const shareCardUrl = (path: string): string =>
  `${SHARE_CARD_ORIGIN}/${SHARE_CARD_DESIGN}${path === '/' ? '' : path}`

/** A card that shows photographs is heavier and is delivered as a JPEG. */
export const shareCardHasPictures = (content: ShareCardContent): boolean =>
  content.kind === 'title' && Boolean(content.picture || content.pictures?.length)

const ENTITIES: Record<string, string> = {
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
}
const decodeAttribute = (value: string): string =>
  value.replace(/&(?:quot|#x27|#39|lt|gt|amp);/gu, entity => ENTITIES[entity] ?? entity)

const KINDS = new Set(['default', 'text', 'word', 'title'])

/** What a rendered page says its share image shows; nothing when it says nothing readable. */
export const readShareCardMeta = (html: string): ShareCardContent | undefined => {
  // A quote inside the value is always written as an entity, so the value ends at the next
  // quote, whatever else it holds.
  const attribute =
    new RegExp(`<meta\\s+name="${SHARE_CARD_META}"\\s+content="([^"]*)"`, 'u').exec(html)?.[1] ??
    new RegExp(`<meta\\s+content="([^"]*)"\\s+name="${SHARE_CARD_META}"`, 'u').exec(html)?.[1]
  if (!attribute) return undefined
  try {
    const content = JSON.parse(decodeAttribute(attribute)) as { kind?: unknown }
    return typeof content.kind === 'string' && KINDS.has(content.kind)
      ? (content as ShareCardContent)
      : undefined
  } catch {
    return undefined
  }
}
