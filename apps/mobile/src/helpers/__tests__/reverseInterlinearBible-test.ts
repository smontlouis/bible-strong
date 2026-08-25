import {
  buildReverseInterlinearSpans,
  reconcileReverseInterlinearChapter,
} from '../reverseInterlinearBible'

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

describe('reconcileReverseInterlinearChapter', () => {
  const sourceToken = (id: number, ordinal: number, code: string, verse = 1) => ({
    id,
    verse,
    ordinal,
    startOffset: 0,
    length: 1,
    surface: `source-${id}`,
    segments: [
      {
        ordinal: 0,
        startOffset: 0,
        length: 1,
        transliteration: `source-${id}`,
        lemma: `source-${id}`,
        morphology: 'HN',
        gloss: `source-${id}`,
        identities: [{ kind: 'strong' as const, code }],
      },
    ],
  })

  it('reconstructs omitted STEP links deterministically from matching Strong identities', () => {
    const result = reconcileReverseInterlinearChapter({
      targetSpansByVerse: {
        1: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 2,
            identities: [{ kind: 'strong', code: 'H5921' }],
          },
        ],
        4: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 2,
            identities: [{ kind: 'strong', code: 'H3588' }],
          },
        ],
      },
      sourceTokens: [sourceToken(196237, 1, 'H5921'), sourceToken(196263, 0, 'H3588')],
    })

    expect(result.spansByVerse[1]?.[0]?.sourceTokens).toEqual([
      expect.objectContaining({ id: 196237 }),
    ])
    expect(result.spansByVerse[4]?.[0]?.sourceTokens).toEqual([
      expect.objectContaining({ id: 196263 }),
    ])
    expect(result.diagnostics).toEqual({
      inferredAssociationCount: 2,
      missingExplicitTokenIds: [],
      duplicateExplicitTokenIds: [],
      incompatibleExplicitAssociations: [],
      unresolvedStrongReferences: [],
    })
  })

  it('keeps the presentation and reports an unresolved word when no source token matches', () => {
    const result = reconcileReverseInterlinearChapter({
      targetSpansByVerse: {
        1: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 2,
            identities: [{ kind: 'strong', code: 'H9999' }],
          },
        ],
      },
      sourceTokens: [sourceToken(1, 0, 'H5921')],
    })

    expect(result.spansByVerse[1]?.[0]?.sourceTokens).toEqual([])
    expect(result.diagnostics.unresolvedStrongReferences).toEqual(['1:0:9999'])
  })

  it('claims duplicate explicit IDs once and diagnoses incompatible explicit links', () => {
    const result = reconcileReverseInterlinearChapter({
      targetSpansByVerse: {
        1: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 2,
            identities: [{ kind: 'strong', code: 'H5921' }],
            stepTokenIds: [7],
          },
          {
            ordinal: 1,
            startOffset: 3,
            length: 2,
            identities: [{ kind: 'strong', code: 'H3588' }],
            stepTokenIds: [7],
          },
        ],
      },
      sourceTokens: [sourceToken(7, 0, 'H9999'), sourceToken(8, 1, 'H3588')],
    })

    expect(result.spansByVerse[1]?.[0]?.sourceTokens).toEqual([expect.objectContaining({ id: 7 })])
    expect(result.spansByVerse[1]?.[1]?.sourceTokens).toEqual([expect.objectContaining({ id: 8 })])
    expect(result.diagnostics).toEqual(
      expect.objectContaining({
        duplicateExplicitTokenIds: [7],
        incompatibleExplicitAssociations: ['1:0:7'],
      })
    )
  })

  it('pairs repeated Strong identities by chapter verse order rather than token ID', () => {
    const result = reconcileReverseInterlinearChapter({
      targetSpansByVerse: {
        1: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 2,
            identities: [{ kind: 'strong', code: 'H5921' }],
          },
        ],
        2: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 2,
            identities: [{ kind: 'strong', code: 'H5921' }],
          },
        ],
      },
      sourceTokens: [sourceToken(1, 0, 'H5921', 2), sourceToken(99, 0, 'H5921', 1)],
    })

    expect(result.spansByVerse[1]?.[0]?.sourceTokens[0]?.id).toBe(99)
    expect(result.spansByVerse[2]?.[0]?.sourceTokens[0]?.id).toBe(1)
  })

  it('uses one source occurrence to cover every matching identity on the same span', () => {
    const token = sourceToken(1, 0, 'H0001')
    token.segments.push({
      ...token.segments[0]!,
      ordinal: 1,
      identities: [{ kind: 'strong', code: 'H0002' }],
    })
    const result = reconcileReverseInterlinearChapter({
      targetSpansByVerse: {
        1: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 2,
            identities: [
              { kind: 'strong', code: 'H0001' },
              { kind: 'strong', code: 'H0002' },
            ],
          },
        ],
      },
      sourceTokens: [token],
    })

    expect(result.spansByVerse[1]?.[0]?.sourceTokens).toHaveLength(1)
    expect(result.diagnostics.unresolvedStrongReferences).toEqual([])
  })
})
