import { buildReverseInterlinearSpans } from '../reverseInterlinearBible'

describe('buildReverseInterlinearSpans', () => {
  it('puts the translated span before its aligned inflected STEP tokens', () => {
    const originalText = 'בְּרֵאשִׁית בָּרָא'

    expect(
      buildReverseInterlinearSpans({
        originalText,
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
        lexicalEntries: [],
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

  it('uses the Strong lexical form without contextual morphology when STEP alignment is missing', () => {
    expect(
      buildReverseInterlinearSpans({
        originalText: '',
        targetSpans: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 4,
            identities: [{ kind: 'strong', code: 'G3056' }],
            stepTokenIds: [],
          },
        ],
        sourceTokens: [],
        lexicalEntries: [
          {
            Code: '3056',
            Hebreu: '',
            Grec: 'λόγος',
            Phonetique: 'logos',
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        sourceTokens: [
          expect.objectContaining({
            surface: 'λόγος',
            lexicalFallback: true,
            segments: [
              expect.objectContaining({
                lemma: 'λόγος',
                transliteration: 'logos',
                morphology: '',
                identities: [{ kind: 'strong', code: 'G3056' }],
              }),
            ],
          }),
        ],
      }),
    ])
  })

  it('adds an unconjugated lexical fallback for each Strong identity missing from a partial STEP alignment', () => {
    const [span] = buildReverseInterlinearSpans({
      originalText: 'λόγος',
      targetSpans: [
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          identities: [
            { kind: 'strong', code: 'G3056' },
            { kind: 'strong', code: 'G2532' },
          ],
          stepTokenIds: [1],
        },
      ],
      sourceTokens: [
        {
          id: 1,
          ordinal: 0,
          startOffset: 0,
          length: 5,
          segments: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 5,
              transliteration: 'logos',
              lemma: 'λόγος',
              morphology: 'GNcmsn',
              gloss: 'word',
              identities: [{ kind: 'strong', code: 'G3056' }],
            },
          ],
        },
      ],
      lexicalEntries: [
        {
          Code: '2532',
          Hebreu: '',
          Grec: 'καί',
          Phonetique: 'kai',
        },
      ],
    })

    expect(span?.sourceTokens).toEqual([
      expect.objectContaining({ surface: 'λόγος' }),
      expect.objectContaining({
        surface: 'καί',
        lexicalFallback: true,
        segments: [expect.objectContaining({ morphology: '' })],
      }),
    ])
  })

  it('uses every effective Strong identity when building lexical fallbacks', () => {
    const [span] = buildReverseInterlinearSpans({
      originalText: '',
      targetSpans: [
        {
          ordinal: 0,
          startOffset: 0,
          length: 13,
          identities: [
            { kind: 'strong', code: 'H3068' },
            { kind: 'dstrong', code: 'H3068G' },
            { kind: 'strong', code: 'H0413' },
          ],
          stepTokenIds: [],
        },
      ],
      sourceTokens: [],
      lexicalEntries: [
        { Code: '3068', Hebreu: 'יהוה', Grec: '', Phonetique: 'YHWH' },
        { Code: '413', Hebreu: 'אֵל', Grec: '', Phonetique: 'el' },
      ],
    })

    expect(
      span?.sourceTokens.map(token => ({
        surface: token.surface,
        identities: token.segments[0]?.identities,
      }))
    ).toEqual([
      {
        surface: 'יהוה',
        identities: [{ kind: 'dstrong', code: 'H3068G' }],
      },
      {
        surface: 'אֵל',
        identities: [{ kind: 'strong', code: 'H0413' }],
      },
    ])
  })
})
