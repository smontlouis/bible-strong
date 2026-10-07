// Inline and block formatting kept from editorial content. Headings start at the third
// level: the page title and its sections are the first two.
const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'small',
  'cite',
  'br',
  'hr',
  'p',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'sup',
  'sub',
  'blockquote',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])
// Source headings are shifted under the page title and its section titles.
const TAG_ALIASES: Record<string, string> = { h1: 'h3', h2: 'h3' }
const VOID_TAGS = new Set(['br', 'hr'])
const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gu
const HREF_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')

// Source text already carries HTML entities; only stray angle brackets need neutralizing.
const neutralizeText = (text: string): string => text.replace(/</gu, '&lt;').replace(/>/gu, '&gt;')

export type EditorialHtmlOptions = {
  /** Rewrites the text between tags, already safe to inject; it may add trusted markup. */
  transformText?: (text: string) => string
  /**
   * Turns the target of a source link into a site URL. A link whose target is not
   * resolved is dropped and its text kept: no source `href` is ever emitted as written.
   */
  resolveHref?: (href: string) => string | undefined
}

/**
 * Rebuilds editorial HTML from an allowlist. Tags are re-emitted by name without any
 * attribute, unknown tags are dropped, links only survive through `resolveHref`, and
 * unbalanced markup is closed, so the result is safe to inject whatever the source held.
 */
export const sanitizeEditorialHtml = (
  html: string,
  options: EditorialHtmlOptions | NonNullable<EditorialHtmlOptions['transformText']> = {}
): string => {
  const { transformText = (text: string) => text, resolveHref } =
    typeof options === 'function' ? { transformText: options } : options
  const output: string[] = []
  const open: string[] = []
  let position = 0

  const pushText = (text: string) => {
    if (text) output.push(transformText(neutralizeText(text)))
  }
  const closeDownTo = (tag: string) => {
    const openedAt = open.lastIndexOf(tag)
    if (openedAt === -1) return
    while (open.length > openedAt) output.push(`</${open.pop()}>`)
  }

  for (const match of html.matchAll(TAG_PATTERN)) {
    pushText(html.slice(position, match.index))
    position = match.index + match[0].length

    const closing = match[1] === '/'
    const name = match[2]?.toLowerCase() ?? ''
    const tag = TAG_ALIASES[name] ?? name

    if (tag === 'a') {
      if (closing) {
        closeDownTo('a')
        continue
      }
      const source = HREF_PATTERN.exec(match[0])
      const href = (source?.[1] ?? source?.[2] ?? source?.[3] ?? '').replace(/&amp;/gu, '&')
      const resolved = href && resolveHref ? resolveHref(href) : undefined
      if (!resolved) continue
      // A link cannot hold another one.
      closeDownTo('a')
      open.push('a')
      output.push(`<a href="${escapeHtml(resolved)}">`)
      continue
    }

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
    closeDownTo(tag)
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

/**
 * Plain text for metadata: tags removed, common entities decoded, whitespace collapsed.
 * The end of a block separates words, as it does on the page.
 */
export const editorialHtmlToText = (html: string): string =>
  html
    .replace(/<br\s*\/?>|<\/(?:p|div|li|dd|dt|td|th|tr|blockquote|h[1-6])>/giu, ' ')
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
