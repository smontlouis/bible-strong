import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import StrongConcordancePage from '../StrongConcordancePage'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
const mockLoadPages = jest.fn()
const mockLoadCounts = jest.fn()
const mockResources = {
  lexiconBible: {
    loadFoundVersesByBook: mockLoadPages,
    loadCountsByBook: mockLoadCounts,
    loadLemmaStats: async () => ({
      status: 'available',
      provenance: { versionId: 'KJV' },
      lemmas: [],
    }),
  },
}
jest.mock('~features/resources/resourceAccess', () => ({ useResourceAccess: () => mockResources }))
jest.mock('@legendapp/list', () => ({ LegendList: 'LegendList' }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))
jest.mock('~common/HorizontalControlScrollView', () => 'HorizontalScrollView')
jest.mock('~common/ui/PageContent', () => ({ pageContentStyle: {} }))
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  HStack: 'HStack',
  VStack: 'VStack',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~features/bible/ConcordanceVerse', () => 'ConcordanceVerse')
const entry: StrongLexiconEntry = {
  id: 266,
  selectedIdentity: { kind: 'dstrong', code: 'G0266' },
  stepCode: 'G0266',
  classicStrong: 'G0266',
  eStrong: 'G0266',
  dStrong: 'G0266',
  language: 'greek',
  baseCode: 266,
  original: 'ἁμαρτία',
  transliteration: 'hamartia',
  gloss: 'sin',
  relations: [],
  resources: [],
  lsjAbsent: false,
  modules: {
    resources: { moduleId: 'resources', status: 'missing' },
    entities: { moduleId: 'entities', status: 'missing' },
  },
}
const availablePage = {
  status: 'available',
  provenance: { versionId: 'KJV' },
  verses: [{ Livre: 45, Chapitre: 6, Verset: 16, Texte: 'test' }],
  nextPageToken: 'next',
}
let tree: ReactTestRenderer
let fragment: ReactTestRenderer | undefined
let client: QueryClient
const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  mockLoadPages.mockReset()
  mockLoadCounts.mockReset().mockResolvedValue({
    status: 'available',
    provenance: { versionId: 'KJV' },
    counts: [{ versesCountByBook: 12 }],
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  act(() => {
    tree?.unmount()
    fragment?.unmount()
  })
  fragment = undefined
  client.clear()
})
const render = async () => {
  act(() => {
    tree = create(
      <QueryClientProvider client={client}>
        <StrongConcordancePage
          entry={entry}
          currentVersionId="KJV"
          defaultVersionId="KJV"
          preferredInterlinearLocale="en"
          onOpenVerse={() => {}}
        />
      </QueryClientProvider>
    )
  })
  await flush()
}
const list = () => tree.root.find(node => String(node.type) === 'LegendList')
const footer = () => {
  act(() => {
    fragment = create(list().props.ListFooterComponent)
  })
  return fragment!.root
}
it('shows an error and retries an unavailable first page', async () => {
  mockLoadPages.mockResolvedValueOnce({ status: 'unavailable' }).mockResolvedValue(availablePage)
  await render()
  const root = footer()
  expect(
    root.findAll(node => String(node.type) === 'Text' && node.props.accessibilityRole === 'alert')
  ).toHaveLength(1)
  act(() => root.find(node => String(node.type) === 'TouchableBox').props.onPress())
  await flush()
  expect(list().props.data).toHaveLength(1)
})
it('keeps the loaded page and retries its cursor after a pagination failure', async () => {
  mockLoadPages
    .mockResolvedValueOnce(availablePage)
    .mockResolvedValueOnce({ status: 'unavailable' })
    .mockResolvedValue({
      ...availablePage,
      verses: [{ Livre: 45, Chapitre: 6, Verset: 17 }],
      nextPageToken: null,
    })
  await render()
  act(() => list().props.onEndReached())
  await flush()
  expect(list().props.data).toHaveLength(1)
  act(() => list().props.onEndReached())
  await flush()
  expect(mockLoadPages).toHaveBeenCalledTimes(2)
  const root = footer()
  act(() => root.find(node => String(node.type) === 'TouchableBox').props.onPress())
  await flush()
  expect(mockLoadPages.mock.calls[2][0].pageToken).toBe('next')
  expect(list().props.data).toHaveLength(2)
})
it('does not present the loaded page size as the total when counts fail', async () => {
  mockLoadPages.mockResolvedValue(availablePage)
  mockLoadCounts.mockRejectedValue(new Error('offline'))
  await render()
  act(() => {
    fragment = create(list().props.ListHeaderComponent)
  })
  expect(
    fragment!.root.findAll(node => String(node.type) === 'Text' && node.props.children === '—')
  ).toHaveLength(1)
  expect(list().props.data).toHaveLength(1)
})
it('explains a successfully loaded empty page', async () => {
  mockLoadPages.mockResolvedValue({ ...availablePage, verses: [], nextPageToken: null })
  await render()
  expect(list().props.ListEmptyComponent.props.children).toBe('strongDetail.concordance.empty')
})
