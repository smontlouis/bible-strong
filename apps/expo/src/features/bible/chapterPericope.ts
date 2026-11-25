import type { Pericope, Verse } from '~common/types'
import type { PericopeChapter } from './BibleDOM/BibleDOMWrapper'

/**
 * The section headings of the chapter the verses come from. While a new chapter loads, the reader
 * still shows the previous one: its headings go with it, never those of the chapter on its way.
 */
export const getVersesPericopeChapter = (
  pericope: Pericope | null | undefined,
  verses: readonly Verse[]
): PericopeChapter => {
  const firstVerse = verses[0]
  if (!firstVerse) return {}
  return pericope?.[firstVerse.Livre]?.[firstVerse.Chapitre] ?? {}
}
