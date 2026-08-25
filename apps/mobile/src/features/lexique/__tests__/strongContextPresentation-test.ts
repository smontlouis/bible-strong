import {
  formatStrongContextMorphology,
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
