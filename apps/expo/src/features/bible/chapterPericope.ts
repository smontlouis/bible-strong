import type { Pericope, Verse } from '~common/types'
import type { ParallelVerse, PericopeChapter } from './BibleDOM/BibleDOMWrapper'

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

/**
 * The section headings of a parallel column, by the main version's verse they stand opposite.
 * An aligned column (another numbering) may hold verses of two chapters: each row takes the
 * headings of the first of its verses; a column aligned by number keeps its chapter's headings.
 */
export const getParallelPericopeChapter = (
  pericope: Pericope | null | undefined,
  parallel: Pick<ParallelVerse, 'verses' | 'alignment'>
): PericopeChapter => {
  if (!parallel.alignment) return getVersesPericopeChapter(pericope, parallel.verses)
  const chapter: PericopeChapter = {}
  for (const [mainVerse, verseKeys] of Object.entries(parallel.alignment.versesByMainVerse)) {
    const [book, verseChapter, verse] = (verseKeys[0] ?? '').split('-')
    const headings = pericope?.[book]?.[verseChapter]?.[verse]
    if (headings) chapter[mainVerse] = headings
  }
  return chapter
}
