import {
  getOpenedResultAnalytics,
  getPassageMatchAnalytics,
  getPublicSearchResultCounts,
  getSearchAnalyticsInputKind,
} from '../searchAnalyticsModel'

describe('search analytics model', () => {
  it.each([
    ['Jean 3:16', true, false, 'reference'],
    ['G26', false, true, 'strong'],
    ['ἀγάπη', false, false, 'greek'],
    ['אֱלֹהִים', false, false, 'hebrew'],
    ['je me sens seul', false, false, 'natural_language'],
    ['amour', false, false, 'keyword'],
  ] as const)('classifies %s', (query, isBibleReference, isStrongReference, expected) => {
    expect(
      getSearchAnalyticsInputKind({
        query,
        isBibleReference,
        isStrongReference,
        strongResults: [],
      })
    ).toBe(expected)
  })

  it('recognizes an exact transliteration from Strong results', () => {
    expect(
      getSearchAnalyticsInputKind({
        query: 'agape',
        isBibleReference: false,
        isStrongReference: false,
        strongResults: [
          {
            id: 26,
            stepCode: 'G26',
            classicStrong: 'G26',
            language: 'greek',
            original: 'ἀγάπη',
            transliteration: 'agapē',
            gloss: 'amour',
          },
        ],
      })
    ).toBe('transliteration')
  })

  it('counts only public Bible-resource sections', () => {
    const sections = [
      { id: 'reference', count: 1, items: [], title: '', itemFilterType: 'passages' },
      { id: 'passages', count: 22, items: [], title: '', itemFilterType: 'passages' },
      { id: 'notes', count: 50, items: [], title: '', itemFilterType: 'notes' },
      { id: 'strong', count: 4, items: [], title: '', itemFilterType: 'strong' },
    ] as never
    expect(getPublicSearchResultCounts(sections)).toEqual({
      total: 27,
      references: 1,
      passages: 22,
      strong: 4,
      dictionary: 0,
      nave: 0,
    })
  })

  it('reports mixed passage matching and a safe opened-passage identity', () => {
    const results = [
      {
        version: 'LSG',
        book: 43,
        chapter: 3,
        verse: 16,
        text: '',
        highlighted: '',
        match: { kind: 'lexical' },
      },
      {
        version: 'LSG',
        book: 19,
        chapter: 23,
        verse: 1,
        text: '',
        highlighted: '',
        match: { kind: 'semantic', topicId: 'topic:trust' },
      },
    ] as const
    expect(getPassageMatchAnalytics(results)).toEqual({
      matchKind: 'mixed',
      topicId: 'topic:trust',
    })

    const item = {
      id: 'passage:LSG:43-3-16',
      type: 'passages',
      iconType: 'passages',
      title: 'Jean 3:16',
      passage: results[0],
    } as const
    expect(
      getOpenedResultAnalytics(item, [
        { id: 'passages', title: '', count: 1, items: [item], itemFilterType: 'passages' },
      ])
    ).toEqual({ type: 'passage', key: 'passage:LSG:43-3-16', rank: 1 })
  })
})
