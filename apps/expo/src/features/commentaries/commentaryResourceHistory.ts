import { getCommentaryBookLabel } from './commentaryBookLabel'
import type { parseCommentaryResourceParams } from './commentaryResourceParams'

type ParsedCommentaryResource = NonNullable<ReturnType<typeof parseCommentaryResourceParams>>

/**
 * The History entry of a commentary chapter or section, or null while the requested section
 * is still loading (its verse range names the passage).
 */
export const getCommentaryResourceHistoryEntry = (
  parsed: ParsedCommentaryResource | undefined,
  sectionId: string | undefined,
  section: { rangeStartVerse: number; rangeEndVerse: number } | undefined
) => {
  if (!parsed || (sectionId && !section)) return null
  const range = section
    ? `:${section.rangeStartVerse}${
        section.rangeEndVerse === section.rangeStartVerse ? '' : `-${section.rangeEndVerse}`
      }`
    : ''
  return {
    type: 'commentary-resource' as const,
    projectionId: parsed.projection.projectionId,
    book: parsed.book,
    chapter: parsed.chapter,
    sectionId,
    title: parsed.entry.title,
    passage: `${getCommentaryBookLabel(parsed.book)} ${parsed.chapter}${range}`,
  }
}
