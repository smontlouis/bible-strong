import {
  getChapterEntityQueryPlan,
  getDisplayedChapterEntityStrongCodes,
} from '../chapterEntityQueryPlan'

describe('getDisplayedChapterEntityStrongCodes', () => {
  it('collects and deduplicates codes from Strong and reverse-interlinear spans', () => {
    expect(
      getDisplayedChapterEntityStrongCodes([
        {
          Livre: 40,
          Chapitre: 21,
          Verset: 1,
          Texte: 'Texte',
          StrongSpans: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 5,
              identities: [{ kind: 'strong', code: 'G2064' }],
            },
          ],
          ReverseInterlinearSpans: [
            {
              ordinal: 1,
              startOffset: 6,
              length: 5,
              identities: [
                { kind: 'strong', code: 'G2064' },
                { kind: 'strong', code: 'G2414' },
              ],
              sourceTokens: [],
            },
          ],
        },
      ])
    ).toEqual(['G2064', 'G2414'])
  })
})

describe('getChapterEntityQueryPlan', () => {
  it('waits for the Strong code query before loading entities for a plain chapter', () => {
    expect(
      getChapterEntityQueryPlan({
        chapterReady: true,
        chapterKind: 'plain',
        contextualInformationDisplay: true,
        displayedStrongCodes: [],
        isContextFocused: false,
        strongCodesQueryFetched: false,
      })
    ).toEqual({
      codes: [],
      codesReady: false,
      shouldCheckAvailability: true,
      shouldLoadEntities: false,
      shouldLoadStrongCodes: true,
    })
  })

  it('uses the resolved Strong codes for a plain chapter', () => {
    expect(
      getChapterEntityQueryPlan({
        chapterReady: true,
        chapterKind: 'plain',
        contextualInformationDisplay: true,
        displayedStrongCodes: [],
        isContextFocused: false,
        loadedStrongCodes: ['G2424', 'G5547'],
        strongCodesQueryFetched: true,
      })
    ).toEqual({
      codes: ['G2424', 'G5547'],
      codesReady: true,
      shouldCheckAvailability: true,
      shouldLoadEntities: true,
      shouldLoadStrongCodes: true,
    })
  })

  it.each(['strong', 'reverse-interlinear'] as const)(
    'reuses codes already present in a %s chapter',
    chapterKind => {
      expect(
        getChapterEntityQueryPlan({
          chapterReady: true,
          chapterKind,
          contextualInformationDisplay: true,
          displayedStrongCodes: ['G2424'],
          isContextFocused: false,
          loadedStrongCodes: ['G0001'],
          strongCodesQueryFetched: false,
        })
      ).toEqual({
        codes: ['G2424'],
        codesReady: true,
        shouldCheckAvailability: true,
        shouldLoadEntities: true,
        shouldLoadStrongCodes: false,
      })
    }
  )

  it('falls back to displayed codes after an unavailable Strong code query', () => {
    expect(
      getChapterEntityQueryPlan({
        chapterReady: true,
        chapterKind: 'plain',
        contextualInformationDisplay: true,
        displayedStrongCodes: [],
        isContextFocused: false,
        strongCodesQueryFetched: true,
      })
    ).toEqual({
      codes: [],
      codesReady: true,
      shouldCheckAvailability: true,
      shouldLoadEntities: true,
      shouldLoadStrongCodes: true,
    })
  })

  it.each([
    { chapterReady: false, contextualInformationDisplay: true, isContextFocused: false },
    { chapterReady: true, contextualInformationDisplay: false, isContextFocused: false },
    { chapterReady: true, contextualInformationDisplay: true, isContextFocused: true },
  ])('does not budget contextual requests for an inactive context', context => {
    expect(
      getChapterEntityQueryPlan({
        ...context,
        chapterKind: 'plain',
        displayedStrongCodes: [],
        strongCodesQueryFetched: false,
      })
    ).toEqual({
      codes: [],
      codesReady: false,
      shouldCheckAvailability: false,
      shouldLoadEntities: false,
      shouldLoadStrongCodes: false,
    })
  })
})
