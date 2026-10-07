import { editorialHtmlToText, sanitizeEditorialHtml, truncateText } from '../resources/editorialHtml'
import { resolveEditorialHref } from '../resources/editorialLinks'
import type { ResourceLanguage } from '../resources/publicSite'

// A link out to the publisher of a source is not a page of the site, and its label
// ("View … in context") would read as a dead link: both are left out, with the paragraph
// that only holds them.
const EXTERNAL_SOURCE_LINK = String.raw`<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*>[\s\S]*?<\/a>`
const EXTERNAL_SOURCE_PATTERN = new RegExp(
  String.raw`<p>\s*(?:<br\s*\/?>\s*)?${EXTERNAL_SOURCE_LINK}\s*<\/p>|${EXTERNAL_SOURCE_LINK}`,
  'giu'
)

/**
 * Commentaries come from several markup traditions (OSIS, GBF, ThML). Their own elements
 * are rewritten into the formatting the editorial allowlist keeps; anything else loses its
 * tag and keeps its text. Element names are matched with their case: GBF closes `<FI>`
 * with `<Fi>`.
 */
const DIALECT_REWRITES: readonly (readonly [RegExp, string])[] = [
  // An escaped character reference is a conversion artifact, never text to display.
  [/&amp;(nbsp|#\d+|#x[0-9a-f]+);/giu, '&$1;'],
  // GBF: italics, bold, and references written `#John 3:1|` between underline marks.
  [/<FI>/gu, '<i>'],
  [/<Fi>/gu, '</i>'],
  [/<FB>/gu, '<b>'],
  [/<Fb>/gu, '</b>'],
  [/<FU>#?/gu, ''],
  [/\|?<Fu>/gu, ''],
  // OSIS: the words being commented, notes, outline items, line breaks and note marks.
  [/<catchWord\b[^>]*>/gu, '<b>'],
  [/<\/catchWord>/gu, '</b>'],
  [/<note\b[^>]*>\s*/gu, '<small> ('],
  [/\s*<\/note>/gu, ')</small>'],
  [/<item\b[^>]*>/gu, '<p>'],
  [/<\/item>/gu, '</p>'],
  [/<lb\b[^>]*>/gu, '<br>'],
  [/<mn\b[^>]*>/gu, '<sup>'],
  [/<\/mn>/gu, '</sup>'],
  // A word tagged with its Strong number links to that entry.
  [/<w\b[^>]*\blemma="strong:([HG]\d+)"[^>]*>([^<]*)<\/w>/gu, '<a href="strong://$1">$2</a>'],
  // Verse and paragraph numbers running in the text.
  [/<span>(\d{1,3})<\/span>/gu, '<sup>$1</sup>'],
]

// Elements a paragraph cannot hold: a browser closes the paragraph before them.
const PARAGRAPH_BREAKERS = new Set([
  'p',
  'ul',
  'ol',
  'dl',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'table',
  'blockquote',
])
const SANITIZED_TAG_PATTERN = /<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gu

/**
 * Closes a paragraph where a block starts inside it, drops the closing tag left behind and
 * the paragraphs left empty, so the markup reads the same before and after a browser
 * parses it. The input is sanitized HTML: lowercase tags without attributes, links aside.
 */
const tidyParagraphs = (html: string): string => {
  // Inline elements open in the current paragraph; undefined outside a paragraph.
  let depth: number | undefined
  const tidied = html.replace(SANITIZED_TAG_PATTERN, (tag, closing: string, name: string) => {
    if (name === 'br') return tag
    if (closing) {
      if (name === 'p') {
        const open = depth !== undefined
        depth = undefined
        return open ? tag : ''
      }
      if (depth && !PARAGRAPH_BREAKERS.has(name)) depth -= 1
      return tag
    }
    if (!PARAGRAPH_BREAKERS.has(name)) {
      if (depth !== undefined) depth += 1
      return tag
    }
    // A block inside inline formatting cannot be untangled here: it is left as written.
    const interrupts = depth === 0
    if (name === 'p') depth = 0
    else if (interrupts) depth = undefined
    return interrupts ? `</p>${tag}` : tag
  })
  return tidied.replace(/<p>(?:\s|<br>)*<\/p>/gu, '')
}

/**
 * Renders the HTML of a commentary section for a page of the site: source markup is
 * normalized, formatting is rebuilt from the editorial allowlist, and links only survive
 * when they lead to a Bible passage or a Strong entry of the site.
 */
export const renderCommentaryHtml = (
  html: string,
  { language }: { language: ResourceLanguage }
): string => {
  let source = html.replace(EXTERNAL_SOURCE_PATTERN, '')
  for (const [pattern, replacement] of DIALECT_REWRITES) {
    source = source.replace(pattern, replacement)
  }
  // The section title is the second level of the page: a source whose headings start at
  // the fourth level would skip one.
  if (!/<h[1-3]\b/iu.test(source)) source = source.replace(/<(\/?)h4\b/giu, '<$1h3')
  return tidyParagraphs(
    sanitizeEditorialHtml(source, { resolveHref: href => resolveEditorialHref(href, { language }) })
  )
}

// Typographic entities met in commentary sources; any other named one is left out, because
// metadata cannot carry a character reference.
const TEXT_ENTITIES: Record<string, string> = {
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  mdash: '—',
  ndash: '–',
}

const plainText = (html: string): string =>
  editorialHtmlToText(html.replace(/<\/?(?:p|h[3-6]|li|dd|dt|td|th|blockquote)>/gu, ' '))
    .replace(/&([a-z]+);/giu, (_, name: string) => TEXT_ENTITIES[name] ?? '')
    .replace(/\s+/gu, ' ')
    .trim()

/**
 * The opening words of rendered commentary HTML, as plain text for metadata. Headings
 * repeat the reference of the passage, so the text under them is preferred.
 */
export const commentaryExcerpt = (html: string, maxLength: number): string =>
  truncateText(
    plainText(html.replace(/<h[3-6]>[\s\S]*?<\/h[3-6]>/gu, ' ')) || plainText(html),
    maxLength
  )
