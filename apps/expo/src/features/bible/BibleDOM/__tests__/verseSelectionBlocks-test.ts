import type { Verse } from '~common/types'
import { tokenizeVerseText } from '~helpers/wordTokenizer'
import { getVerseSelectionBlocks } from '../verseSelectionBlocks'

const verse = (number: number, text = 'Au commencement Dieu') =>
  ({ Livre: 1, Chapitre: 1, Verset: number, Texte: text }) as Verse

const verses = [verse(1), verse(2), verse(3), verse(4), verse(5, 'Il y eut un soir')]

const getBlocks = (selected: number[], column?: number) =>
  getVerseSelectionBlocks({
    selectedVerses: Object.fromEntries(selected.map(number => [`1-1-${number}`, true])),
    verses,
    version: 'LSG',
    column,
    getTokens: (_verseKey, text) => tokenizeVerseText(text),
  })

describe('verse selection blocks', () => {
  it('turns verses that follow one another into one range of words', () => {
    expect(getBlocks([2, 3])).toEqual([
      {
        start: { verseKey: '1-1-2', wordIndex: 0 },
        end: { verseKey: '1-1-3', wordIndex: 2 },
        version: 'LSG',
      },
    ])
  })

  it('keeps apart verses with unselected ones between them', () => {
    expect(getBlocks([1, 3, 4]).map(({ start, end }) => [start.verseKey, end.verseKey])).toEqual([
      ['1-1-1', '1-1-1'],
      ['1-1-3', '1-1-4'],
    ])
  })

  it('ends a block on the last word of its last verse', () => {
    expect(getBlocks([5])[0].end).toEqual({ verseKey: '1-1-5', wordIndex: 4 })
  })

  it('names the parallel column the handles stand in', () => {
    expect(getBlocks([1], 1)[0].column).toBe(1)
  })

  it('has no block without a selected verse', () => {
    expect(getBlocks([])).toEqual([])
  })
})
