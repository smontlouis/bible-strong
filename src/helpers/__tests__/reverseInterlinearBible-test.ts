import { buildReverseInterlinearSpans } from '../reverseInterlinearBible'

describe('buildReverseInterlinearSpans', () => {
  it('puts the translated span before its aligned inflected STEP tokens', () => {
    expect(
      buildReverseInterlinearSpans({
        targetSpans: [
          {
            ordinal: 0,
            startOffset: 3,
            length: 12,
            identities: [
              { kind: 'strong', code: 'H7225' },
              { kind: 'dstrong', code: 'H7225G' },
            ],
            stepTokenIds: [2, 1],
          },
        ],
        sourceTokens: [
          {
            id: 1,
            ordinal: 0,
            startOffset: 0,
            length: 11,
            surface: 'בְּרֵאשִׁית',
            segments: [
              {
                ordinal: 0,
                startOffset: 0,
                length: 11,
                transliteration: 'be.re.Shit',
                lemma: 'רֵאשִׁית',
                morphology: 'HNcfsa',
                gloss: 'commencement',
                identities: [{ kind: 'strong', code: 'H7225' }],
              },
            ],
          },
          {
            id: 2,
            ordinal: 1,
            startOffset: 12,
            length: 6,
            surface: 'בָּרָא',
            segments: [
              {
                ordinal: 0,
                startOffset: 0,
                length: 6,
                transliteration: "ba.Ra'",
                lemma: 'בָּרָא',
                morphology: 'HVqp3ms',
                gloss: 'créa',
                identities: [{ kind: 'strong', code: 'H1254' }],
              },
            ],
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        ordinal: 0,
        sourceTokens: [
          expect.objectContaining({ id: 1, surface: 'בְּרֵאשִׁית' }),
          expect.objectContaining({ id: 2, surface: 'בָּרָא' }),
        ],
      }),
    ])
  })
})
