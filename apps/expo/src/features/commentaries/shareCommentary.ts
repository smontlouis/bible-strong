import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import { isTag, isText, type AnyNode } from 'domhandler'
import { parseDocument } from 'htmlparser2'
import { cleanReadingHTML } from '~common/readingHtml'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getPublicSiteUrl } from '~helpers/publicSiteLinks'
import type { ResourceShare } from '~features/share/resourceShare'
import { buildPublicCommentaryPath } from './publicCommentaryRoutes'

// Same cap as the pre-27 commentary share, which users relied on to copy commentaries.
const SHARE_MAX_LENGTH = 10000
const BLOCK_TAGS = new Set(['p', 'div', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

const nodesToText = (nodes: AnyNode[]): string =>
  nodes
    .map(node => {
      if (isText(node)) return node.data
      if (!isTag(node)) return ''
      if (node.name === 'br') return '\n'
      const text = nodesToText(node.children)
      return BLOCK_TAGS.has(node.name) ? `\n${text}\n` : text
    })
    .join('')

/** Plain text of commentary HTML, keeping paragraphs as blank-line separated blocks. */
export const commentaryHtmlToText = (html: string): string =>
  nodesToText(parseDocument(cleanReadingHTML(html)).children)
    .split('\n')
    .map(line => line.replace(/[ \t\r]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()

const truncate = (text: string): string =>
  text.length <= SHARE_MAX_LENGTH
    ? text
    : `${text.slice(0, SHARE_MAX_LENGTH).replace(/\s+\S*$/u, '')}…`

type CommentaryShareOptions = {
  entry: Pick<CommentaryCatalogEntry, 'id' | 'author' | 'title'>
  passage: string
  sections: { reference?: string; content: string }[]
  /** The chapter being read: it names the page of the commentary on the public site. */
  location: { language: ResourceLanguage; book: number; chapter: number }
}

export const getCommentaryShareText = ({
  entry,
  passage,
  sections,
}: Omit<CommentaryShareOptions, 'location'>): string => {
  const body = sections
    .map(section => {
      const text = commentaryHtmlToText(section.content)
      return section.reference ? `${section.reference}\n${text}` : text
    })
    .filter(Boolean)
    .join('\n\n')
  return `${entry.author}\n${entry.title}\n${passage}\n\n${truncate(body)}`
}

/** What a commentary being read hands over: the page of its chapter, and its text. */
export const getCommentaryShare = ({
  location,
  ...options
}: CommentaryShareOptions): ResourceShare => ({
  url: getPublicSiteUrl(() =>
    buildPublicCommentaryPath({ resourceId: options.entry.id, ...location })
  ),
  title: `${options.entry.author} — ${options.passage}`,
  text: () => getCommentaryShareText(options),
})
