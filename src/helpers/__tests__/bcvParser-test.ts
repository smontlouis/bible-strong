jest.mock('../../../i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

jest.mock('bible-passage-reference-parser/esm/lang/fr.js', () => ({}))
jest.mock('bible-passage-reference-parser/esm/lang/en.js', () => ({}))
jest.mock('bible-passage-reference-parser/esm/bcv_parser.js', () => ({
  bcv_parser: class {
    translations = {
      systems: {
        default: {
          order: {
            Gen: 1,
            Ps: 19,
            John: 43,
            '1Cor': 46,
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
  })
})
