import * as Sentry from '@sentry/react-native'
import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import { isTag, isText, type AnyNode } from 'domhandler'
import { parseDocument } from 'htmlparser2'
import { Share } from 'react-native'
import { cleanReadingHTML } from '~common/readingHtml'
import { toast } from '~helpers/toast'
import i18n from '~i18n'

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

export const getCommentaryShareMessage = ({
  entry,
  passage,
  sections,
}: {
  entry: Pick<CommentaryCatalogEntry, 'author' | 'title'>
  passage: string
  sections: { reference?: string; content: string }[]
}): string => {
  const body = sections
    .map(section => {
      const text = commentaryHtmlToText(section.content)
      return section.reference ? `${section.reference}\n${text}` : text
    })
    .filter(Boolean)
    .join('\n\n')
  return `${entry.author}\n${entry.title}\n${passage}\n\n${truncate(body)}\n\nhttps://bible-strong.app`
}

export const shareCommentary = async (
  options: Parameters<typeof getCommentaryShareMessage>[0]
): Promise<void> => {
  try {
    await Share.share({ message: getCommentaryShareMessage(options) })
  } catch (error) {
    toast.error(i18n.t('Erreur lors du partage.'))
    Sentry.captureException(error)
  }
}
