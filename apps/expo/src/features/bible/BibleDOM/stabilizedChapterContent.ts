import { useEffect, useState } from 'react'
import type { Verse } from '~common/types'
import type { ParallelVerse, PericopeChapter } from './BibleDOMWrapper'

export type ChapterContent = {
  verses: Verse[]
  parallelVerses: ParallelVerse[]
  pericopeChapter: PericopeChapter
  parallelPericopeChapters?: Record<string, PericopeChapter | undefined>
}

/**
 * Prevents rapid empty→loaded prop updates on the Expo DOM bridge: skips updates when loading with
 * no verses, so the DOM component only receives the real data once it's ready. The parallel
 * versions and the section headings travel with the verses they sit next to: the reader never
 * pairs a chapter with the columns or the headings of another, even for one frame.
 */
export function useStabilizedChapterContent(content: ChapterContent, isLoading: boolean) {
  const [stable, setStable] = useState(content)
  const { verses, parallelVerses } = content
  // Headings are rebuilt on each render: compared by content, they only move when they change.
  const headingsKey = JSON.stringify([content.pericopeChapter, content.parallelPericopeChapters])

  useEffect(() => {
    if (isLoading && verses.length === 0) return
    setStable(content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses, parallelVerses, headingsKey, isLoading])

  return stable
}
