const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'br',
  'p',
  'ul',
  'ol',
  'li',
  'sup',
  'sub',
  'blockquote',
])
const VOID_TAGS = new Set(['br'])
const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gu

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')

// Source text already carries HTML entities; only stray angle brackets need neutralizing.
const neutralizeText = (text: string): string => text.replace(/</gu, '&lt;').replace(/>/gu, '&gt;')

/**
 * Rebuilds editorial HTML from an allowlist. Tags are re-emitted by name without any
 * attribute, unknown tags are dropped, and unbalanced markup is closed, so the result is
 * safe to inject whatever the source contained.
 */
export const sanitizeEditorialHtml = (
  html: string,
  transformText: (text: string) => string = text => text
): string => {
  const output: string[] = []
  const open: string[] = []
  let position = 0

  const pushText = (text: string) => {
    if (text) output.push(transformText(neutralizeText(text)))
  }

  for (const match of html.matchAll(TAG_PATTERN)) {
    pushText(html.slice(position, match.index))
    position = match.index + match[0].length

    const closing = match[1] === '/'
    const tag = match[2]?.toLowerCase() ?? ''
    if (!ALLOWED_TAGS.has(tag)) continue
    if (VOID_TAGS.has(tag)) {
      if (!closing) output.push(`<${tag}>`)
      continue
    }
    if (!closing) {
      open.push(tag)
      output.push(`<${tag}>`)
      continue
    }
    const openedAt = open.lastIndexOf(tag)
    if (openedAt === -1) continue
    while (open.length > openedAt) output.push(`</${open.pop()}>`)
  }
  pushText(html.slice(position))
  while (open.length) output.push(`</${open.pop()}>`)

  return output.join('')
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Plain text for metadata: tags removed, common entities decoded, whitespace collapsed. */
export const editorialHtmlToText = (html: string): string =>
  html
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/<[^>]*>/gu, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/giu, (entity, name: string) => {
      const key = name.toLowerCase()
      if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16))
      if (key.startsWith('#')) return String.fromCodePoint(Number(key.slice(1)))
      return ENTITIES[key] ?? entity
    })
    .replace(/\s+/gu, ' ')
    .trim()

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength - 1)
  const endsOnWord = /\s/u.test(text[maxLength - 1] ?? '')
  const lastSpace = cut.lastIndexOf(' ')
  const kept = endsOnWord || lastSpace <= maxLength * 0.6 ? cut : cut.slice(0, lastSpace)
  return `${kept.replace(/[\s,;:.–—-]+$/u, '')}…`
}
