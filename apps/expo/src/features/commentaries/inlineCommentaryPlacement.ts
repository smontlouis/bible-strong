import type {
  ReadingIndex,
  ReadingIndexRequest,
  ReadingIndexResult,
} from '~features/resources/commentaryReadingAccess'
import {
  groupByResourceChapter,
  resourceChapterOpensReaderChapter,
  resourceRangeInReaderChapter,
  type ReaderChapter,
} from '~features/resources/resourceNumbering'

export type InlineCommentarySection = {
  sectionId: string
  rangeStartVerse: number
  rangeEndVerse: number
  excerpt: string
}

export type InlineCommentaryChip = InlineCommentarySection & {
  resourceId: string
  language: 'fr' | 'en'
  revision: string
  /** The commentary chapter that holds the section (KJV Mal 4 in LSG Mal 3); the reader's when undefined. */
  chapter?: number
  sections: InlineCommentarySection[]
}

/** A reading index whose verse ranges are those of the reader's chapter. */
export type InlineCommentaryIndex = {
  resource: Pick<ReadingIndex['resource'], 'resourceId' | 'language' | 'revision'>
  /** The commentary chapter the sections come from; the reader's when undefined. */
  chapter?: number
  sections: readonly ReadingIndex['sections'][number][]
}

/**
 * The indexes of the commentary chapters a reader chapter maps to, with each section's range
 * brought into the reader's numbering and clipped to the reader's chapter (KJV Malachi 4:5-6 is
 * LSG Malachi 3:23-24). A section outside the reader's chapter is left out, and an introduction
 * is kept only from the commentary chapter that opens the reader's chapter.
 */
export function readerInlineCommentaryIndexes(
  reader: ReaderChapter,
  loaded: readonly { chapter: number; index: ReadingIndex }[]
): InlineCommentaryIndex[] {
  return loaded.flatMap(({ chapter, index }) => {
    const resource = `commentary:${index.resource.resourceId}`
    const opensChapter = resourceChapterOpensReaderChapter(reader, resource, chapter)
    const sections = index.sections.flatMap(section => {
      if (section.rangeStartVerse === 0 && section.rangeEndVerse === 0) {
        return opensChapter ? [section] : []
      }
      const range = resourceRangeInReaderChapter(reader, resource, chapter, {
        start: section.rangeStartVerse,
        end: section.rangeEndVerse,
      })
      return range ? [{ ...section, rangeStartVerse: range.start, rangeEndVerse: range.end }] : []
    })
    return sections.length ? [{ resource: index.resource, chapter, sections }] : []
  })
}

/**
 * The inline commentaries of a reader chapter: each commentary is read in the chapters its
 * numbering gives the reader's chapter, one request per chapter for the commentaries sharing it,
 * and its sections come back in the reader's numbering.
 */
export async function loadReaderInlineCommentaries(
  reader: ReaderChapter,
  resources: ReadingIndexRequest['resources'],
  loadIndex: (request: ReadingIndexRequest) => Promise<ReadingIndexResult>
): Promise<{
  indexes: InlineCommentaryIndex[]
  unavailable: ReadingIndexResult['unavailable']
  cached: boolean
}> {
  const groups = groupByResourceChapter(
    reader,
    resources,
    resource => `commentary:${resource.resourceId}`
  )
  const results = await Promise.all(
    groups.map(async ({ chapter, items }) => ({
      chapter,
      result: await loadIndex({ book: reader.book, chapter, resources: items }),
    }))
  )
  const unavailable: ReadingIndexResult['unavailable'] = []
  for (const { result } of results) {
    for (const resource of result.unavailable) {
      if (
        !unavailable.some(
          item => item.resourceId === resource.resourceId && item.language === resource.language
        )
      )
        unavailable.push(resource)
    }
  }
  const order = (index: InlineCommentaryIndex) =>
    resources.findIndex(
      resource =>
        resource.resourceId === index.resource.resourceId &&
        resource.language === index.resource.language
    )
  return {
    // In the order the reader chose the commentaries, each one's chapters in canonical order.
    indexes: readerInlineCommentaryIndexes(
      reader,
      results.flatMap(({ chapter, result }) => result.indexes.map(index => ({ chapter, index })))
    ).sort((left, right) => order(left) - order(right)),
    unavailable,
    cached: results.some(({ result }) => result.cached),
  }
}

/** Only the displayed summary crosses the Bible DOM bridge; options stay in the native/app layer. */
export function summarizeInlineCommentaryChip(chip: InlineCommentaryChip) {
  const { sections, ...summary } = chip
  return { ...summary, sectionCount: sections.length }
}

/** One chip per resource and visible anchor, regardless of the number of source sections. */
export function placeInlineCommentaries(
  indexes: readonly InlineCommentaryIndex[],
  displayedVerses: readonly number[],
  focused: boolean
) {
  const verses = [
    ...new Set(displayedVerses.filter(verse => Number.isInteger(verse) && verse > 0)),
  ].sort((a, b) => a - b)
  const introduction: InlineCommentaryChip[] = []
  const afterVerses: Record<number, InlineCommentaryChip[]> = {}
  for (const index of indexes) {
    const groups = new Map<number, InlineCommentaryChip>()
    for (const section of index.sections) {
      const introductionSection = section.rangeStartVerse === 0 && section.rangeEndVerse === 0
      if (introductionSection && (focused || !verses.length)) continue
      const anchor = introductionSection
        ? 0
        : verses
            .filter(verse => verse >= section.rangeStartVerse && verse <= section.rangeEndVerse)
            .at(-1)
      if (anchor === undefined) continue
      const option: InlineCommentarySection = {
        sectionId: section.id,
        rangeStartVerse: section.rangeStartVerse,
        rangeEndVerse: section.rangeEndVerse,
        excerpt: section.excerpt,
      }
      const existing = groups.get(anchor)
      if (existing) {
        if (!existing.sections.some(item => item.sectionId === section.id))
          existing.sections.push(option)
        continue
      }
      const chip: InlineCommentaryChip = {
        resourceId: index.resource.resourceId,
        language: index.resource.language,
        revision: index.resource.revision,
        ...(index.chapter !== undefined && { chapter: index.chapter }),
        sectionId: section.id,
        rangeStartVerse: section.rangeStartVerse,
        rangeEndVerse: section.rangeEndVerse,
        excerpt: section.excerpt,
        sections: [option],
      }
      groups.set(anchor, chip)
      if (anchor === 0) introduction.push(chip)
      else (afterVerses[anchor] ??= []).push(chip)
    }
  }
  return { introduction, afterVerses }
}
