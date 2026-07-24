import type { Pericope, Verse } from '~common/types'

export type CanonicalBibleHeading = {
  offset: number
  order: number
  kind: 'heading' | 'pericope' | 'parallel' | string
  type: string
  text: string
  markup: string
  attributes?: Record<string, string>
}

export const getCanonicalChapterPericope = (verses: Verse[]): Pericope => {
  const pericope: Pericope = {}

  for (const verse of verses) {
    for (const heading of [...(verse.Headings ?? [])].sort(
      (left, right) => left.offset - right.offset || left.order - right.order
    )) {
      const book = String(verse.Livre)
      const chapter = String(verse.Chapitre)
      const verseNumber = String(verse.Verset)
      const headings = ((pericope[book] ??= {})[chapter] ??= {})
      const verseHeadings = (headings[verseNumber] ??= {})
      const preferredLevel = getHeadingLevel(heading)
      const level = !verseHeadings[preferredLevel]
        ? preferredLevel
        : (['h4', 'h3', 'h2', 'h1'] as const).find(candidate => !verseHeadings[candidate])
      if (level) verseHeadings[level] = heading.text.trim()
    }
  }

  return pericope
}

const getHeadingLevel = (heading: CanonicalBibleHeading): 'h1' | 'h2' | 'h3' | 'h4' => {
  if (heading.kind === 'parallel') return 'h4'
  if (heading.type === 'majorSection') return 'h1'
  if (
    heading.type === 'scope' ||
    heading.type === 'psalm' ||
    heading.type === 'acrostic' ||
    heading.kind === 'heading'
  ) {
    return 'h2'
  }
  if (heading.type === 'section') return 'h3'
  if (heading.kind === 'pericope') return 'h3'
  return 'h4'
}
