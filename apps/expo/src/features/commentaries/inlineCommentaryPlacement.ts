import type { ReadingIndex } from '~features/resources/commentaryReadingAccess'

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
  sections: InlineCommentarySection[]
}

/** Only the displayed summary crosses the Bible DOM bridge; options stay in the native/app layer. */
export function summarizeInlineCommentaryChip(chip: InlineCommentaryChip) {
  const { sections, ...summary } = chip
  return { ...summary, sectionCount: sections.length }
}

/** One chip per resource and visible anchor, regardless of the number of source sections. */
export function placeInlineCommentaries(
  indexes: readonly ReadingIndex[],
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
