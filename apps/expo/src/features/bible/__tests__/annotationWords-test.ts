import type { Verse } from '~common/types'
import {
  formatWordsQuote,
  getAnnotationWordRanges,
  getLastAnnotationMark,
  getSelectionWordRanges,
  getWordRangesVerseKeys,
  getWordRangesText,
} from '../annotationWords'
import { collectSelectionStrongWords, isGrammaticalStrongIdentity } from '../selectionStrongWords'

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}))

const verse = (number: number, text: string) =>
  ({ Livre: 43, Chapitre: 3, Verset: number, Texte: text }) as Verse

const verses = [
  verse(16, 'Car Dieu a tant aimé le monde qu’il a donné son Fils unique,'),
  verse(17, 'Dieu, en effet, n’a pas envoyé son Fils dans le monde'),
]

describe('getSelectionWordRanges', () => {
  it('holds the selected words of one verse with their place in its text', () => {
    const ranges = getSelectionWordRanges(
      { start: { verseKey: '43-3-16', wordIndex: 2 }, end: { verseKey: '43-3-16', wordIndex: 6 } },
      verses
    )
    expect(ranges).toEqual([
      {
        verseKey: '43-3-16',
        startWordIndex: 2,
        endWordIndex: 6,
        charStart: 9,
        charEnd: 29,
        text: 'a tant aimé le monde',
      },
    ])
  })

  it('reads a selection made backwards and across two verses in reading order', () => {
    const ranges = getSelectionWordRanges(
      { start: { verseKey: '43-3-17', wordIndex: 1 }, end: { verseKey: '43-3-16', wordIndex: 11 } },
      verses
    )
    expect(ranges.map(range => range.text)).toEqual(['Fils unique,', 'Dieu, en'])
    expect(getWordRangesVerseKeys(ranges)).toEqual(['43-3-16', '43-3-17'])
    expect(getWordRangesText(ranges)).toBe('Fils unique, Dieu, en')
  })

  it('holds nothing when the selection is in verses no longer on screen', () => {
    expect(
      getSelectionWordRanges(
        { start: { verseKey: '43-4-1', wordIndex: 0 }, end: { verseKey: '43-4-1', wordIndex: 2 } },
        verses
      )
    ).toEqual([])
  })
})

describe('getAnnotationWordRanges', () => {
  it('finds the words of an annotation in the verses on screen', () => {
    const ranges = getAnnotationWordRanges(
      [{ verseKey: '43-3-17', startWordIndex: 5, endWordIndex: 6 }],
      verses
    )
    expect(ranges[0]).toMatchObject({ text: 'envoyé son', charStart: 24, charEnd: 34 })
  })
})

describe('formatWordsQuote', () => {
  it('quotes the words and names where they are read', () => {
    const ranges = getSelectionWordRanges(
      { start: { verseKey: '43-3-16', wordIndex: 2 }, end: { verseKey: '43-3-16', wordIndex: 6 } },
      verses
    )
    expect(formatWordsQuote(ranges, 'LSG', text => `« ${text} »`)).toBe(
      '« a tant aimé le monde »\nJean 3:16 (LSG)'
    )
  })

  it('leaves out the punctuation the selection took at its edges', () => {
    const ranges = getSelectionWordRanges(
      { start: { verseKey: '43-3-17', wordIndex: 0 }, end: { verseKey: '43-3-17', wordIndex: 2 } },
      verses
    )
    expect(formatWordsQuote(ranges, 'LSG', text => `« ${text} »`)).toBe(
      '« Dieu, en effet »\nJean 3:17 (LSG)'
    )
  })
})

describe('collectSelectionStrongWords', () => {
  const ranges = getSelectionWordRanges(
    { start: { verseKey: '43-3-16', wordIndex: 2 }, end: { verseKey: '43-3-16', wordIndex: 6 } },
    verses
  )
  const span = (ordinal: number, startOffset: number, length: number, code: string) => ({
    ordinal,
    startOffset,
    length,
    identities: [{ kind: 'strong' as const, code }],
  })

  it('lists the entries under the selected words in reading order, each once', () => {
    const words = collectSelectionStrongWords(
      ranges,
      {
        '43-3-16': [
          span(4, 24, 5, 'G2889'),
          span(1, 4, 4, 'G2316'),
          span(2, 11, 4, 'G3779'),
          span(3, 16, 4, 'G25'),
          span(5, 21, 2, 'G3588'),
          span(6, 26, 3, 'G2889'),
        ],
      },
      { '43-3-16': verses[0].Texte }
    )
    expect(words.map(word => [word.word, word.identity.code])).toEqual([
      ['tant', 'G3779'],
      ['aimé', 'G25'],
      ['monde', 'G2889'],
    ])
  })

  it('keeps the morphology of the entry it lists', () => {
    const [word] = collectSelectionStrongWords(
      ranges,
      {
        '43-3-16': [
          {
            ...span(3, 16, 4, 'G25'),
            morphologies: [{ identity: { kind: 'strong', code: 'G25' }, codes: ['V-AAI-3S'] }],
          },
        ],
      },
      { '43-3-16': verses[0].Texte }
    )
    expect(word.morphologyCodes).toEqual(['V-AAI-3S'])
  })
})

describe('isGrammaticalStrongIdentity', () => {
  it('sets aside the article, the object marker and the Hebrew prefixes', () => {
    expect(isGrammaticalStrongIdentity({ kind: 'strong', code: 'G3588' })).toBe(true)
    expect(isGrammaticalStrongIdentity({ kind: 'strong', code: 'H853' })).toBe(true)
    expect(isGrammaticalStrongIdentity({ kind: 'estrong', code: 'H9003' })).toBe(true)
    expect(isGrammaticalStrongIdentity({ kind: 'strong', code: 'G25' })).toBe(false)
    expect(isGrammaticalStrongIdentity({ kind: 'strong', code: 'H430' })).toBe(false)
  })
})

describe('getLastAnnotationMark', () => {
  it('takes the mark of the latest annotation', () => {
    expect(
      getLastAnnotationMark({
        a: { color: 'color2', type: 'underline', date: 2 },
        b: { color: 'color4', type: 'circle', date: 3 },
        c: { color: 'color1', type: 'background', date: 1 },
      })
    ).toEqual({ color: 'color4', type: 'circle' })
  })

  it('highlights in the first color when there is no annotation yet', () => {
    expect(getLastAnnotationMark({})).toEqual({ color: 'color1', type: 'background' })
  })
})
