import { buildStrongAnnotatedText, type StrongBibleSpan } from '../strongBibleOverlay'

describe('Strong Bible overlay', () => {
  it('adds legacy-compatible Strong references without changing the canonical source text', () => {
    const text = 'Au commencement, Dieu créa.'
    const spans: StrongBibleSpan[] = [
      {
        ordinal: 0,
        startOffset: 17,
        length: 4,
        identities: [{ kind: 'strong', code: 'H0430' }],
      },
    ]

    expect(buildStrongAnnotatedText(text, spans)).toBe('Au commencement, Dieu 0430 créa.')
    expect(text).toBe('Au commencement, Dieu créa.')
  })

  it('ignores unaligned occurrences and identities unsupported by the legacy lexicon UI', () => {
    expect(
      buildStrongAnnotatedText('Dieu', [
        {
          ordinal: 0,
          startOffset: 0,
          length: 0,
          identities: [{ kind: 'strong', code: 'H0430' }],
        },
        {
          ordinal: 1,
          startOffset: 0,
          length: 4,
          identities: [{ kind: 'dstrong', code: 'H0430G' }],
        },
      ])
    ).toBe('Dieu')
  })
})
