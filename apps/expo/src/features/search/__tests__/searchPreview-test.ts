import { createPreviewSearchFilters, loadSearchPreview } from '../searchPreview'

jest.mock('~helpers/bibleVersions', () => ({ getBibleVersionCanonId: () => 'protestant-66' }))
jest.mock('~helpers/bcvParser', () => ({
  parseBibleReferenceSegments: () => [],
  isExactBibleReferenceInput: (query: string) => query === 'Jean 3:16',
}))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))

function harness() {
  const resources = {
    bibleSearch: { searchPage: jest.fn(async () => ({ results: [], count: 0 })) },
    strongLexicon: {
      listEntries: jest.fn(async () => ({ entries: [] })),
      loadPreview: jest.fn(async () => []),
    },
    dictionary: {
      listByLetterPage: jest.fn(async () => ({ entries: [] })),
      searchPage: jest.fn(async () => ({ entries: [] })),
    },
    nave: {
      listByLetterPage: jest.fn(async () => ({ topics: [] })),
      searchPage: jest.fn(async () => ({ topics: [] })),
    },
  }
  return {
    resources,
    query: 'amour',
    version: 'LSG',
    languages: { STRONG: 'fr' as const, DICTIONNAIRE: 'en' as const, NAVE: 'fr' as const },
    signal: new AbortController().signal,
    t: (key: string) => key,
  }
}

describe('search preview handoff', () => {
  it('carries the requested category and version without inherited global restrictions', () => {
    const filters = createPreviewSearchFilters('KJV', 'strong')
    expect(filters.selectedVersion).toBe('KJV')
    expect(
      Object.entries(filters.itemFilters)
        .filter(([, enabled]) => enabled)
        .map(([source]) => source)
    ).toEqual(['strong'])
    expect(filters).toMatchObject({ book: 0, canon: '', section: '', sortOrder: 'relevance' })
    expect(Object.values(createPreviewSearchFilters('LSG').itemFilters).every(Boolean)).toBe(true)
  })
  it('queries the same passage service with a bounded page, version and cancellation signal', async () => {
    const input = harness()
    await loadSearchPreview({ ...input, source: 'passages' })
    expect(input.resources.bibleSearch.searchPage).toHaveBeenCalledWith(
      'amour',
      expect.objectContaining({
        limit: 3,
        offset: 0,
        version: 'LSG',
        signal: input.signal,
        canon: 'protestant-66',
      })
    )
  })
  it.each(['Jean 3:16', 'G26'])('does not run a text passage search for %s', async query => {
    const input = harness()
    expect(await loadSearchPreview({ ...input, query, source: 'passages' })).toEqual({
      items: [],
      hasMore: false,
    })
    expect(input.resources.bibleSearch.searchPage).not.toHaveBeenCalled()
  })
  it('resolves a Strong code using the exact identity lookup', async () => {
    const input = harness()
    await loadSearchPreview({ ...input, query: 'G26', source: 'strong' })
    expect(input.resources.strongLexicon.loadPreview).toHaveBeenCalled()
    expect(input.resources.strongLexicon.listEntries).not.toHaveBeenCalled()
  })
  it('browses a resource when its chip is selected with an empty input', async () => {
    const input = harness()
    await loadSearchPreview({ ...input, query: '', source: 'dictionary' })
    expect(input.resources.dictionary.searchPage).not.toHaveBeenCalled()
    expect(input.resources.dictionary.listByLetterPage).toHaveBeenCalledWith(
      'a',
      { signal: input.signal, limit: 3 },
      'en'
    )
  })
  it('preserves per-resource languages', async () => {
    const input = harness()
    await loadSearchPreview({ ...input, source: 'dictionary' })
    expect(input.resources.dictionary.searchPage).toHaveBeenCalledWith(
      'amour',
      { signal: input.signal, limit: 3 },
      'en'
    )
  })
  it('propagates a source failure instead of presenting it as an empty result', async () => {
    const input = harness()
    input.resources.nave.searchPage.mockRejectedValueOnce(new Error('offline'))
    await expect(loadSearchPreview({ ...input, source: 'nave' })).rejects.toThrow('offline')
    await expect(loadSearchPreview({ ...input, source: 'dictionary' })).resolves.toEqual({
      items: [],
      hasMore: false,
    })
  })
})
