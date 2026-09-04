import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'

import { parseCommentaryProjectionId } from './commentarySelection'

export const parseCommentaryResourceParams = ({
  projectionId,
  book,
  chapter,
}: {
  projectionId?: string
  book?: string
  chapter?: string
}) => {
  const projection = projectionId ? parseCommentaryProjectionId(projectionId) : undefined
  const entry = projection ? COMMENTARY_CATALOG_BY_ID.get(projection.resourceId) : undefined
  const bookNumber = Number(book)
  const chapterNumber = Number(chapter)
  if (
    !projection ||
    !entry ||
    !Number.isSafeInteger(bookNumber) ||
    bookNumber < 1 ||
    !Number.isSafeInteger(chapterNumber) ||
    chapterNumber < 1
  ) {
    return undefined
  }

  return { projection, entry, book: bookNumber, chapter: chapterNumber }
}

export const commentaryHrefToOsis = (href: string) => {
  const normalized = href
    .trim()
    .replace(/^bible:\/\//iu, '')
    .replace(/^\/+|\/+$/gu, '')
  if (!normalized || /^(?:https?:|mailto:|#)/iu.test(normalized)) return undefined
  return normalized.replaceAll('_', '.')
}

export const formatCommentaryResourceTabTitle = ({
  shortName,
  bookLabel,
  chapter,
  range,
}: {
  shortName: string
  bookLabel: string
  chapter: number
  range?: { start: number; end: number }
}) =>
  `${shortName} - ${bookLabel} ${chapter}${
    range ? `:${range.start}${range.end === range.start ? '' : `-${range.end}`}` : ''
  }`
