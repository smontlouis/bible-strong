import { absoluteSiteUrl } from '../resources/publicSite'
import type { ShareCardContent } from './ShareCard'
import { SHARE_CARD_SIZE } from './shareCardTokens'

/** The meta element in which a page says what its share image shows. */
export const SHARE_CARD_META = 'bible-strong:share-card'
export const SHARE_CARD_ROUTE = '/share-card'

/**
 * The share image of a page, as its head announces it. The page writes what the image shows
 * in a meta element of its own; the image route reads it back from the rendered page, so
 * the image can only ever show what a page of the site shows, and needs no read of its own.
 * A page that says nothing gets the default card.
 */
export const shareCardMeta = (path: string, content?: ShareCardContent) => {
  const image = absoluteSiteUrl(`${SHARE_CARD_ROUTE}${path === '/' ? '' : path}`)
  return [
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: String(SHARE_CARD_SIZE.width) },
    { property: 'og:image:height', content: String(SHARE_CARD_SIZE.height) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: image },
    ...(content ? [{ name: SHARE_CARD_META, content: JSON.stringify(content) }] : []),
  ]
}

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
