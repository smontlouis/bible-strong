import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePassageSearch } from '../usePassageSearch'

let mockConnected = true
const mockSearchPage = jest.fn()
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ bibleSearch: { searchPage: mockSearchPage } }),
}))
jest.mock('~helpers/useConnection', () => () => mockConnected)
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('~helpers/bibleVersions', () => ({ getBibleVersionCanonId: () => 'protestant-66' }))
jest.mock('~helpers/bcvParser', () => ({
  isExactBibleReferenceInput: (value: string) => value === 'Jean 3:16',
}))
jest.mock('../searchResultsModel', () => ({ SEARCH_MIN_QUERY_LENGTH: 3 }))
jest.mock('~helpers/agentObservability', () => ({
  appLogger: { measure: (_category: string, _name: string, run: () => unknown) => run() },
}))

let latest: ReturnType<typeof usePassageSearch>
function Probe({ value, enabled = true }: { value: string; enabled?: boolean }) {
  const result = usePassageSearch({
    searchValue: value,
    version: 'LSG',
    searchLanguage: 'fr',
    enabled,
    book: 43,
    sortOrder: 'book',
  })
  useEffect(() => {
    latest = result
  })
  return null
}
let tree: ReactTestRenderer
let client: QueryClient
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mockConnected = true
  mockSearchPage.mockReset()
  mockSearchPage.mockImplementation(async (_query, options) => ({
    count: 2,
    results: [
      {
        version: 'LSG',
        book: 43,
        chapter: 3,
        verse: options.offset ? 17 : 16,
        text: 'amour',
        highlighted: 'amour',
      },
    ],
  }))
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  act(() => tree?.unmount())
  client.clear()
})
async function render(value: string, enabled = true) {
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <Probe value={value} enabled={enabled} />
      </QueryClientProvider>
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

it('runs text and semantic search with the same filters and deduplicates their results', async () => {
  await render('amour')
  expect(mockSearchPage).toHaveBeenCalledTimes(2)
  expect(mockSearchPage).toHaveBeenCalledWith(
    'amour',
    expect.objectContaining({
      version: 'LSG',
      book: 43,
      sortOrder: 'book',
      searchLanguage: 'fr',
      offset: 0,
    })
  )
  expect(mockSearchPage).toHaveBeenCalledWith(
    'amour',
    expect.objectContaining({ mode: 'semantic' })
  )
  expect(latest.mergedPassages).toHaveLength(1)
  await act(async () => {
    await latest.passageQuery.fetchNextPage()
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })
  expect(mockSearchPage).toHaveBeenLastCalledWith('amour', expect.objectContaining({ offset: 1 }))
  expect(latest.mergedPassages.map(result => result.verse)).toEqual([16, 17])
})

it('keeps text search available offline without requesting semantic search', async () => {
  mockConnected = false
  await render('amour')
  expect(mockSearchPage).toHaveBeenCalledTimes(1)
  expect(mockSearchPage.mock.calls[0][1].mode).toBeUndefined()
})

it.each(['Jean 3:16', 'H123', 'a'])('does not run text search for %s', async value => {
  await render(value)
  expect(mockSearchPage).not.toHaveBeenCalled()
})

it('does not search when the picker is inactive', async () => {
  await render('amour', false)
  expect(mockSearchPage).not.toHaveBeenCalled()
})
