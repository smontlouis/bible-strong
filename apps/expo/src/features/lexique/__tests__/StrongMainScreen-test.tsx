import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import StrongMainScreen from '../StrongMainScreen'
import StrongDetailMainPage from '../StrongDetailMainPage'

const mockQueries: Record<
  string,
  { data?: unknown; isPending?: boolean; isFetching?: boolean; isError?: boolean }
> = {}
const mockRefetch = jest.fn()
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: mockRefetch,
    ...mockQueries[queryKey[2]],
  }),
}))
jest.mock('jotai/react', () => ({ useSetAtom: () => jest.fn() }))
jest.mock('~state/app', () => ({ historyAtom: {} }))
jest.mock('react-redux', () => ({ useSelector: () => 'KJV' }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~features/bible/passageMedia', () => ({ getPassageMediaForStrong: () => [] }))
jest.mock('~helpers/verseToReference', () => ({ __esModule: true, default: () => 'Romans 6:23' }))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => jest.fn() }))
jest.mock('../resolveStrongBibleVersionId', () => ({ resolveStrongBibleVersionId: () => 'KJV' }))
jest.mock('../strongDetailRoutes', () => ({ createStrongDetailRoute: jest.fn() }))
jest.mock('../useStrongEntryRoute', () => ({
  useStrongEntryRoute: () => ({
    resources: {},
    identity: { kind: 'dstrong', code: 'G0266' },
    coreAvailability: {},
    entry: { stepCode: 'G0266', language: 'greek', gloss: 'sin' },
    languageState: { language: 'en' },
  }),
}))
jest.mock('../useStrongReadingTypography', () => ({ useStrongReadingTypography: () => ({}) }))
jest.mock('../useStrongRouteNavigation', () => ({ useStrongRouteNavigation: () => ({}) }))
jest.mock('../StrongEntryRouteScaffold', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('../StrongDetailMainPage', () => ({ __esModule: true, default: () => null }))

let tree: ReactTestRenderer
const render = () => {
  act(() => {
    tree = create(
      <StrongMainScreen
        context={{ book: 45, bibleChapter: 6, bibleVerse: 23, bibleVersion: 'KJV' }}
      />
    )
  })
  return tree.root.findByType(StrongDetailMainPage).props
}
const availableCounts = {
  data: {
    status: 'available',
    provenance: { versionId: 'KJV' },
    counts: [{ versesCountByBook: 12 }],
  },
}
const availablePreview = {
  data: { status: 'available', provenance: { versionId: 'KJV' }, verses: [] },
}
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  for (const key of Object.keys(mockQueries)) delete mockQueries[key]
  mockRefetch.mockClear()
  mockQueries.counts = availableCounts
  mockQueries['concordance-preview'] = availablePreview
})
afterEach(() => {
  act(() => tree?.unmount())
})

it('keeps a loaded total while the three preview verses are pending', () => {
  mockQueries['concordance-preview'] = { isPending: true, isFetching: true }
  const props = render()
  expect(props.concordanceTotalCount).toBe(12)
  expect(props.concordanceLoading).toBe(true)
})
it('keeps a loaded total and offers retry when the preview fails', () => {
  mockQueries['concordance-preview'] = { isError: true }
  const props = render()
  expect(props.concordanceCount).toBe(12)
  expect(props.concordanceError).toBe(true)
  act(() => props.onRetryConcordance())
  expect(mockRefetch).toHaveBeenCalledTimes(3)
})
it('does not report a zero count while the count request is pending', () => {
  mockQueries.counts = { isPending: true, isFetching: true }
  const props = render()
  expect(props.concordanceCount).toBeUndefined()
  expect(props.concordanceLoading).toBe(true)
})
it('reports unavailable resources instead of silently presenting an empty concordance', () => {
  mockQueries['concordance-preview'] = { data: { status: 'unavailable' } }
  expect(render().concordanceError).toBe(true)
})
it('does not mix preview verses from another version into a loaded total', () => {
  mockQueries['concordance-preview'] = {
    data: { status: 'available', provenance: { versionId: 'LSG' }, verses: [{ Livre: 40 }] },
  }
  const props = render()
  expect(props.concordanceCount).toBe(12)
  expect(props.concordanceVerses).toEqual([])
  expect(props.concordanceError).toBe(true)
})
it('preserves a confirmed empty result as zero without an error', () => {
  mockQueries.counts = {
    data: { status: 'available', provenance: { versionId: 'KJV' }, counts: [] },
  }
  const props = render()
  expect(props.concordanceCount).toBe(0)
  expect(props.concordanceError).toBe(false)
  expect(props.concordanceLoading).toBe(false)
})

it('keeps available preview verses when loading the total fails', () => {
  const verse = { Livre: 40, Chapitre: 1, Verset: 21, Texte: 'sins' }
  mockQueries.counts = { isError: true }
  mockQueries['concordance-preview'] = {
    data: { status: 'available', provenance: { versionId: 'KJV' }, verses: [verse] },
  }
  const props = render()
  expect(props.concordanceCount).toBeUndefined()
  expect(props.concordanceVerses).toEqual([verse])
  expect(props.concordanceError).toBe(true)
})
