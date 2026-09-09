import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearchPreview } from '../useSearchPreview'

jest.mock('~state/resourcesLanguage', () => ({ resourcesLanguageAtom: {} }))
const mockSearchPage = jest.fn()
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ bibleSearch: { searchPage: mockSearchPage } }),
}))
jest.mock('~helpers/useConnection', () => ({ __esModule: true, default: () => true }))
jest.mock('~helpers/useDebounce', () => ({ __esModule: true, default: (value: string) => value }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('jotai/react', () => ({
  useAtomValue: () => ({ NAVE: 'fr', STRONG: 'fr', DICTIONNAIRE: 'fr' }),
}))
jest.mock('react-redux', () => ({ useSelector: () => ({}) }))
jest.mock('~helpers/bibleVersions', () => ({ getBibleVersionCanonId: () => 'protestant-66' }))
jest.mock('~helpers/bcvParser', () => ({
  isExactBibleReferenceInput: () => false,
  parseBibleReferenceSegments: () => [],
}))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))

const page = (text: string) => ({
  count: 1,
  results: [{ version: 'LSG', book: 43, chapter: 3, verse: 16, text, highlighted: text }],
})
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

const flush = () => new Promise(resolve => setTimeout(resolve, 20))

it('shows classic results before AI, isolates AI failure, and discards late results from an old query', async () => {
  let resolveOld!: (value: ReturnType<typeof page>) => void
  let rejectNew!: (reason: Error) => void
  let oldSignal: AbortSignal | undefined
  mockSearchPage.mockImplementation((query, options) => {
    if (options.mode !== 'semantic') return Promise.resolve(page(query))
    if (query === 'amour') {
      oldSignal = options.signal
      return new Promise(resolve => {
        resolveOld = resolve
      })
    }
    return new Promise((_resolve, reject) => {
      rejectNew = reject
    })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  let latest!: ReturnType<typeof useSearchPreview>
  function Probe({ query }: { query: string }) {
    latest = useSearchPreview(query, 'LSG', 'passages')
    return null
  }
  const render = (query: string) => (
    <QueryClientProvider client={client}>
      <Probe query={query} />
    </QueryClientProvider>
  )
  let tree!: ReactTestRenderer
  try {
    await act(async () => {
      tree = create(render('amour'))
    })
    await act(async () => {
      await flush()
    })
    expect(latest.sections.find(section => section.source === 'passages')?.items).toHaveLength(1)
    expect(latest.sections.find(section => section.source === 'passages')?.enriching).toBe(true)
    await act(async () => {
      tree.update(render('paix'))
      await flush()
    })
    await act(async () => {
      resolveOld(page('OLD AI'))
      await flush()
    })
    expect(oldSignal?.aborted).toBe(true)
    expect(
      latest.sections
        .flatMap(section => section.items)
        .some(item => item.description?.includes('OLD AI'))
    ).toBe(false)
    await act(async () => {
      rejectNew(new Error('AI unavailable'))
      await flush()
    })
    expect(latest.sections).toHaveLength(1)
    expect(latest.sections[0].error).toBe(false)
    expect(latest.sections[0].enriching).toBe(false)
    mockSearchPage.mockImplementation((query, options) =>
      Promise.resolve(
        options.mode === 'semantic'
          ? {
              count: 2,
              results: [...page(query).results, { ...page('NEW AI').results[0], verse: 17 }],
            }
          : page(query)
      )
    )
    await act(async () => {
      await client.invalidateQueries()
      await flush()
    })
    expect(latest.sections.find(section => section.source === 'passages')?.items).toHaveLength(2)
    expect(latest.sections.find(section => section.source === 'passages')?.error).toBe(false)
    expect(latest.sections.find(section => section.source === 'passages')?.items).toHaveLength(2)
  } finally {
    await act(async () => tree?.unmount())
    client.clear()
  }
})
