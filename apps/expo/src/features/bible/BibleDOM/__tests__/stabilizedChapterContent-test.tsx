import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type { Verse } from '~common/types'
import { useStabilizedChapterContent, type ChapterContent } from '../stabilizedChapterContent'

const verse = (chapter: number, number: number) =>
  ({ Livre: 33, Chapitre: chapter, Verset: number, Texte: '' }) as Verse

const chapterContent = (chapter: number, heading?: string): ChapterContent => ({
  verses: [verse(chapter, 1), verse(chapter, 2)],
  parallelVerses: [],
  pericopeChapter: heading ? { 1: { h3: heading } } : {},
  parallelPericopeChapters: {},
})

const rendered: ChapterContent[] = []

const Harness = ({ content, isLoading }: { content: ChapterContent; isLoading: boolean }) => {
  rendered.push(useStabilizedChapterContent(content, isLoading))
  return null
}

const renderHarness = (content: ChapterContent, isLoading = false) => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(<Harness content={content} isLoading={isLoading} />)
  })
  return {
    update: (next: ChapterContent, nextIsLoading = false) =>
      act(() => {
        renderer?.update(<Harness content={next} isLoading={nextIsLoading} />)
      }),
  }
}

const shownChapter = (content: ChapterContent) => content.verses[0]?.Chapitre
const shownHeading = (content: ChapterContent) => content.pericopeChapter[1]?.h3

describe('useStabilizedChapterContent', () => {
  beforeEach(() => {
    rendered.length = 0
  })

  it('never shows the verses of one chapter with the headings of another', () => {
    const micah5 = chapterContent(5, 'Le Roi naîtra à Bethléhem')
    const micah6 = chapterContent(6, 'Le procès contre des ingrats')
    const harness = renderHarness(micah5)

    harness.update(micah6)

    const headingOf = { 5: micah5.pericopeChapter[1].h3, 6: micah6.pericopeChapter[1].h3 }
    for (const content of rendered) {
      expect(shownHeading(content)).toBe(headingOf[shownChapter(content) as 5 | 6])
    }
    expect(shownChapter(rendered[rendered.length - 1])).toBe(6)
  })

  it('takes headings that arrive after their verses', () => {
    const harness = renderHarness(chapterContent(5))

    harness.update(chapterContent(5, 'Le Roi naîtra à Bethléhem'))

    expect(shownHeading(rendered[rendered.length - 1])).toBe('Le Roi naîtra à Bethléhem')
  })

  it('keeps the chapter on screen while the next one loads without verses', () => {
    const harness = renderHarness(chapterContent(5, 'Le Roi naîtra à Bethléhem'))

    harness.update({ ...chapterContent(6), verses: [] }, true)

    const last = rendered[rendered.length - 1]
    expect(shownChapter(last)).toBe(5)
    expect(shownHeading(last)).toBe('Le Roi naîtra à Bethléhem')
  })
})
