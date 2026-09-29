import type { Verse } from '~common/types'
import {
  formatStrongContextMorphology,
  getStrongContextHighlight,
  getStrongContextVerseText,
} from '../strongContextPresentation'

describe('strongContextPresentation', () => {
  it('uses canonical verse text without reconstructing it from Strong markers', () => {
    expect(
      getStrongContextVerseText({
        Livre: 40,
        Chapitre: 16,
        Verset: 1,
        Texte: ' Les pharisiens\n et les sadducéens abordèrent Jésus. ',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 5,
            length: 10,
            identities: [{ kind: 'strong', code: 'G5330' }],
          },
        ],
      })
    ).toBe(' Les pharisiens\n et les sadducéens abordèrent Jésus. ')
  })

  it('formats the human morphology before its technical code', () => {
    expect(
      formatStrongContextMorphology({
        code: 'N-NPM-T',
        meaning: 'Nom, nominatif, masculin, pluriel, titre',
      })
    ).toBe('nom, nominatif, masculin, pluriel, titre · N-NPM-T')
  })
})

describe('getStrongContextHighlight', () => {
  // Romans 3:8 (LSG): "que" first occurs inside "quelques-uns".
  const texte =
    'Et pourquoi ne ferions-nous pas le mal afin qu’il en arrive du bien, comme quelques-uns, qui nous calomnient, prétendent que nous le disons?'
  const romans3v8: Verse = {
    Livre: 45,
    Chapitre: 3,
    Verset: 8,
    Texte: texte,
    StrongSpans: [
      {
        ordinal: 0,
        startOffset: 75,
        length: 12,
        identities: [{ kind: 'strong', code: 'G5100' }],
      },
      {
        ordinal: 1,
        startOffset: 110,
        length: 10,
        identities: [{ kind: 'strong', code: 'G5346' }],
      },
      {
        ordinal: 2,
        startOffset: 121,
        length: 3,
        identities: [
          { kind: 'strong', code: 'G3754' },
          { kind: 'dstrong', code: 'G3754G' },
        ],
      },
    ],
  }
  const hoti = { stepCode: 'G3754G', dStrong: 'G3754G', eStrong: 'G3754', baseCode: 3754 }
  const highlighted = (verse: Verse, word?: string) => {
    const range = getStrongContextHighlight(verse, hoti, word)
    return range && [range.start, texte.slice(range.start, range.end)]
  }

  it('highlights the span of the entry, not the first substring of the tapped word', () => {
    expect(highlighted(romans3v8, 'que')).toEqual([121, 'que'])
  })

  it('falls back to a whole word when the verse has no Strong spans', () => {
    expect(highlighted({ ...romans3v8, StrongSpans: undefined }, 'que')).toEqual([121, 'que'])
  })

  it('does not highlight a word that only appears inside another word', () => {
    expect(highlighted({ ...romans3v8, StrongSpans: undefined }, 'quel')).toBeUndefined()
  })
})
