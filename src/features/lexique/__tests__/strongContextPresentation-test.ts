import {
  formatStrongContextMorphology,
  getStrongContextVerseText,
} from '../strongContextPresentation'

describe('strongContextPresentation', () => {
  it('removes every Strong and morphology marker from the contextual verse', () => {
    expect(
      getStrongContextVerseText(
        {
          Livre: 40,
          Chapitre: 16,
          Verset: 1,
          Texte:
            'Les 3588 pharisiens 5330 (5754) et 2532 les sadducéens 4523 abordèrent 4334 Jésus.',
        },
        { baseCode: 5330, gloss: 'Pharisien' },
        'pharisiens'
      )
    ).toBe('Les pharisiens et les sadducéens abordèrent Jésus.')
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
