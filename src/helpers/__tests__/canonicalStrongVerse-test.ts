import { buildCanonicalStrongVerseRuns } from '../canonicalStrongVerse'

describe('buildCanonicalStrongVerseRuns', () => {
  it('places empty Strong occurrences at canonical offsets without changing contractions', () => {
    expect(
      buildCanonicalStrongVerseRuns('Qu’il continue', [
        {
          ordinal: 0,
          startOffset: 5,
          length: 0,
          identities: [{ kind: 'strong', code: 'H0347' }],
        },
        {
          ordinal: 1,
          startOffset: 6,
          length: 8,
          identities: [{ kind: 'strong', code: 'H5331' }],
        },
      ])
    ).toEqual([
      { kind: 'text', text: 'Qu’il' },
      {
        kind: 'strong',
        word: '',
        identities: [{ kind: 'strong', code: 'H0347' }],
        isUntranslated: true,
      },
      { kind: 'text', text: ' ' },
      {
        kind: 'strong',
        word: 'continue',
        contextWord: 'continue',
        identities: [{ kind: 'strong', code: 'H5331' }],
        isUntranslated: false,
      },
    ])
  })

  it('can retain only the concordance identity while preserving the complete canonical text', () => {
    expect(
      buildCanonicalStrongVerseRuns(
        'Il prit la parole',
        [
          {
            ordinal: 0,
            startOffset: 2,
            length: 0,
            identities: [{ kind: 'strong', code: 'H0347' }],
          },
          {
            ordinal: 1,
            startOffset: 3,
            length: 4,
            identities: [{ kind: 'strong', code: 'H3947' }],
          },
        ],
        'H0347'
      )
    ).toEqual([
      { kind: 'text', text: 'Il' },
      {
        kind: 'strong',
        word: '',
        identities: [{ kind: 'strong', code: 'H0347' }],
        isUntranslated: true,
      },
      { kind: 'text', text: ' prit la parole' },
    ])
  })
})
