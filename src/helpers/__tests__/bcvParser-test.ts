jest.mock('../../../i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

jest.mock('bible-passage-reference-parser/esm/lang/fr.js', () => ({ language: 'fr' }))
jest.mock('bible-passage-reference-parser/esm/lang/en.js', () => ({ language: 'en' }))
jest.mock('bible-passage-reference-parser/esm/bcv_parser.js', () => ({
  bcv_parser: class {
    language: 'fr' | 'en'

    constructor(languageModule: { language?: 'fr' | 'en' }) {
      this.language = languageModule.language ?? 'fr'
    }

    translations = {
      systems: {
        default: {
          order: {
            Gen: 1,
            Ps: 19,
            Acts: 44,
            John: 43,
            '1Cor': 46,
            Tob: 75,
            PrMan: 84,
          },
          chapters: {},
        },
      },
    }

    set_options = jest.fn()

    parse(text: string) {
      return {
        osis_and_indices: () => {
          if (text === 'Lisez Jean 3:16 et 1 Corinthiens 13:4-8.') {
            return [
              { osis: 'John.3.16', translations: [''], indices: [6, 15] },
              { osis: '1Cor.13.4-1Cor.13.8', translations: [''], indices: [19, 39] },
            ]
          }

          if (text === 'Psaume 23') {
            return [{ osis: 'Ps.23', translations: [''], indices: [0, 9] }]
          }

          if (text === 'Actes 7:59, 60') {
            return [
              { osis: 'Acts.7.59', translations: [''], indices: [0, 10] },
              { osis: 'Acts.7.60', translations: [''], indices: [12, 14] },
            ]
          }

          if (this.language === 'en' && text === 'Read Acts 7:59, 60') {
            return [
              { osis: 'Acts.7.59', translations: [''], indices: [5, 14] },
              { osis: 'Acts.7.60', translations: [''], indices: [16, 18] },
            ]
          }

          return []
        },
      }
    }
  },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { osisToBibleReferenceTarget, parseInlineBibleReferences } = require('../bcvParser')

describe('bcvParser', () => {
  describe('parseInlineBibleReferences', () => {
    it('detects French references with source text positions', () => {
      const text = 'Lisez Jean 3:16 et 1 Corinthiens 13:4-8.'

      expect(parseInlineBibleReferences(text)).toEqual([
        {
          text: 'Jean 3:16',
          start: 6,
          end: 15,
          target: {
            book: 43,
            chapter: 3,
            verse: 16,
            focusVerses: [16],
            osis: 'John.3.16',
          },
        },
        {
          text: '1 Corinthiens 13:4-8',
          start: 19,
          end: 39,
          target: {
            book: 46,
            chapter: 13,
            verse: 4,
            focusVerses: [4, 5, 6, 7, 8],
            osis: '1Cor.13.4-1Cor.13.8',
          },
        },
      ])
    })

    it('opens chapter references without focus verses', () => {
      expect(parseInlineBibleReferences('Psaume 23')).toEqual([
        {
          text: 'Psaume 23',
          start: 0,
          end: 9,
          target: {
            book: 19,
            chapter: 23,
            verse: 1,
            focusVerses: undefined,
            osis: 'Ps.23',
          },
        },
      ])
    })

    it('keeps same-chapter comma sequences as one inline link', () => {
      expect(parseInlineBibleReferences('Actes 7:59, 60')).toEqual([
        {
          text: 'Actes 7:59, 60',
          start: 0,
          end: 14,
          target: {
            book: 44,
            chapter: 7,
            verse: 59,
            focusVerses: [59, 60],
            osis: 'Acts.7.59,Acts.7.60',
          },
        },
      ])
    })

    it('can parse with the explicit plan language instead of the UI language', () => {
      expect(parseInlineBibleReferences('Read Acts 7:59, 60', 'en')).toEqual([
        {
          text: 'Acts 7:59, 60',
          start: 5,
          end: 18,
          target: {
            book: 44,
            chapter: 7,
            verse: 59,
            focusVerses: [59, 60],
            osis: 'Acts.7.59,Acts.7.60',
          },
        },
      ])
    })
  })

  describe('osisToBibleReferenceTarget', () => {
    it('uses the first passage for multi-chapter ranges', () => {
      expect(osisToBibleReferenceTarget('Gen.1.31-Gen.2.3')).toEqual({
        book: 1,
        chapter: 1,
        verse: 31,
        focusVerses: undefined,
        osis: 'Gen.1.31-Gen.2.3',
      })
    })

    it('maps deuterocanonical OSIS codes to stable app book ids', () => {
      expect(osisToBibleReferenceTarget('Tob.2.3')).toEqual({
        book: 67,
        chapter: 2,
        verse: 3,
        focusVerses: [3],
        osis: 'Tob.2.3',
      })
    })

    it('rejects apocryphal OSIS codes outside the supported Clementine canon', () => {
      expect(osisToBibleReferenceTarget('PrMan.1.1')).toBeUndefined()
    })
  })
})
