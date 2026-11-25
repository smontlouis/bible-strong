import type { Pericope, Verse } from '~common/types'
import { getVersesPericopeChapter } from '../chapterPericope'

const verse = (book: number, chapter: number, number: number) =>
  ({ Livre: book, Chapitre: chapter, Verset: number, Texte: '' }) as Verse

const pericope: Pericope = {
  33: {
    5: { 1: { h3: 'Le Roi naîtra à Bethléhem' } },
    6: { 1: { h3: 'Le procès contre des ingrats' } },
  },
}

describe('getVersesPericopeChapter', () => {
  it('gives the headings of the chapter the verses come from', () => {
    expect(getVersesPericopeChapter(pericope, [verse(33, 6, 1), verse(33, 6, 2)])).toEqual({
      1: { h3: 'Le procès contre des ingrats' },
    })
  })

  it('keeps the headings of the previous chapter while its verses are still shown', () => {
    // The reader asks for Micah 6 but still shows Micah 5 until the new chapter has loaded.
    expect(getVersesPericopeChapter(pericope, [verse(33, 5, 1)])).toEqual({
      1: { h3: 'Le Roi naîtra à Bethléhem' },
    })
  })

  it('gives no heading without verses, pericope or headings for the chapter', () => {
    expect(getVersesPericopeChapter(pericope, [])).toEqual({})
    expect(getVersesPericopeChapter(null, [verse(33, 5, 1)])).toEqual({})
    expect(getVersesPericopeChapter(pericope, [verse(40, 1, 1)])).toEqual({})
  })
})
