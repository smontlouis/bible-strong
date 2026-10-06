import {
  editorialHtmlToText,
  sanitizeEditorialHtml,
  truncateText,
} from '../resources/editorialHtml'
import {
  buildBibleReferencePath,
  parseOsisReference,
  resolveEditorialHref,
} from '../resources/editorialLinks'
import type { ResourceLanguage } from '../resources/publicSite'
import { buildDictionaryEntryPath, createDictionaryArticleSlug } from './dictionaryRoutes'

type DictionaryArticleContext = {
  language: ResourceLanguage
  work: string
  /** The article being rendered, which does not link to itself. */
  entryId: number
}

const ANCHOR_PATTERN = /<a\s[^>]*>/giu
const ENTRY_ID_PATTERN = /\sdata-entry-id\s*=\s*["']?(\d{1,15})/iu
const HREF_PATTERN = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/iu
// Never found in a source: only the links rewritten below carry it.
const ENTRY_LINK_PATTERN = /^dictionary-entry:(\d+)\/([a-z0-9-]+)$/u

/**
 * An article names another article of its work by its heading and carries the identity in
 * a data attribute, which the sanitizer does not read: both are folded into the target.
 */
const foldEntryLinks = (html: string): string =>
  html.replace(ANCHOR_PATTERN, tag => {
    const entryId = ENTRY_ID_PATTERN.exec(tag)?.[1]
    if (!entryId) return tag
    const href = HREF_PATTERN.exec(tag)
    const heading = editorialHtmlToText(href?.[1] ?? href?.[2] ?? '')
    return `<a href="dictionary-entry:${entryId}/${createDictionaryArticleSlug(heading)}">`
  })

// The reference Bible of a language holds the Protestant canon only.
const LAST_CANONICAL_BOOK = 66

/** A list of passages or a range of chapters opens at its first passage. */
const resolveBibleHref = (osis: string, language: ResourceLanguage): string | undefined => {
  const first = osis.split(',')[0] ?? ''
  const reference = parseOsisReference(first) ?? parseOsisReference(first.split('-')[0] ?? '')
  if (!reference || reference.book > LAST_CANONICAL_BOOK) return undefined
  return buildBibleReferencePath(language, reference)
}

const resolveHref = (
  href: string,
  { language, work, entryId }: DictionaryArticleContext
): string | undefined => {
  const entry = ENTRY_LINK_PATTERN.exec(href)
  if (entry) {
    const target = Number(entry[1])
    return target > 0 && target !== entryId
      ? buildDictionaryEntryPath({ language, work, entryId: target, word: entry[2] ?? '' })
      : undefined
  }
  const bible = /^bible:(?:\/\/)?(.+)$/u.exec(href)
  if (bible) return resolveBibleHref(bible[1] ?? '', language)
  return resolveEditorialHref(href, { language })
}

// What ends an open paragraph, as a browser reads it.
const PARAGRAPH_BREAKERS = new Set([
  'p',
  'ul',
  'ol',
  'dl',
  'blockquote',
  'table',
  'hr',
  'h2',
  'h3',
  'h4',
  'h5',
])
const VOID_TAGS = new Set(['br', 'hr'])
const TAG_PATTERN = /<(\/?)([a-z][a-z0-9]*)[^>]*>/gu

/**
 * Sanitized markup is balanced, but a source may still open a block inside a paragraph.
 * The paragraph ends where the block starts and paragraphs left empty are dropped, so the
 * markup is the tree a browser would build from it.
 */
const closeParagraphs = (html: string): string => {
  const output: string[] = []
  const open: string[] = []
  let position = 0

  const closeDownTo = (tag: string) => {
    const openedAt = open.lastIndexOf(tag)
    if (openedAt === -1) return
    while (open.length > openedAt) output.push(`</${open.pop()}>`)
  }

  for (const match of html.matchAll(TAG_PATTERN)) {
    output.push(html.slice(position, match.index))
    position = match.index + match[0].length
    const tag = match[2] ?? ''
    // The closing tag of an element ended early finds nothing left to close.
    if (match[1] === '/') {
      closeDownTo(tag)
      continue
    }
    if (PARAGRAPH_BREAKERS.has(tag)) closeDownTo('p')
    if (!VOID_TAGS.has(tag)) open.push(tag)
    output.push(match[0])
  }
  output.push(html.slice(position))
  while (open.length) output.push(`</${open.pop()}>`)

  return output.join('').replace(/<p>\s*<\/p>/gu, '')
}

/**
 * Sanitizes an article and resolves its links to site pages: other articles of the work,
 * Bible passages and Strong entries. The article sits right under the page title, so the
 * headings kept by the sanitizer (third level and below) move up one level.
 */
export const renderDictionaryArticleHtml = (
  html: string,
  context: DictionaryArticleContext
): string =>
  closeParagraphs(
    sanitizeEditorialHtml(foldEntryLinks(html), {
      resolveHref: href => resolveHref(href, context),
    }).replace(
      /<(\/?)h([3-6])>/gu,
      (_, slash: string, level: string) => `<${slash}h${Number(level) - 1}>`
    )
  )

const BLOCK_END_PATTERN = /<\/(?:p|div|h[1-6]|li|dt|dd|tr|blockquote)>/giu

/** The first words of an article as plain text, for metadata. */
export const dictionaryArticleExcerpt = (html: string, maxLength: number): string =>
  truncateText(editorialHtmlToText(html.replace(BLOCK_END_PATTERN, ' ')), maxLength)
