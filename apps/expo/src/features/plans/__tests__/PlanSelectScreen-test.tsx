import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import PlanSelect from '../PlanSelectScreen'
import type { ReadingPlanFilters, ReadingPlanFilterParams } from '../readingPlanFilters'

let mockUserLanguage = 'fr'
let mockFilters!: ReadingPlanFilters
let mockHeader!: {
  onReset: () => void
  filters: { key: string; options?: { key: string; selected: boolean; onSelect: () => void }[] }[]
}
let mockParams: ReadingPlanFilterParams = {}
const mockRouter = {
  setParams: jest.fn((next: ReadingPlanFilterParams) => {
    mockParams = { ...mockParams, ...next }
  }),
}
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: mockUserLanguage } }),
}))
jest.mock('~common/FiltersHeader', () => ({
  __esModule: true,
  default: (props: typeof mockHeader) => {
    mockHeader = props
    return null
  },
}))
jest.mock('~common/ContextualPanel/PanelSearch', () => ({ __esModule: true, default: () => null }))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Container', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('../ReadingPlansScreen', () => ({
  __esModule: true,
  default: ({ filters }: { filters: ReadingPlanFilters }) => {
    mockFilters = filters
    return null
  },
}))

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('reads filters from route parameters and uses the user language for a fresh entry', () => {
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(<PlanSelect />)
    })
    expect(mockHeader.filters.map(filter => filter.key)).toEqual(['search', 'language'])
    expect(mockFilters).toEqual({ query: '', language: 'fr' })
    act(() =>
      mockHeader.filters
        .find(filter => filter.key === 'language')!
        .options!.find(option => option.key === 'en')!
        .onSelect()
    )
    expect(mockRouter.setParams).toHaveBeenLastCalledWith({ language: 'en', search: '' })

    act(() => tree.update(<PlanSelect />))
    expect(mockFilters.language).toBe('en')
    mockParams = {}
    act(() => tree.update(<PlanSelect />))
    expect(mockFilters.language).toBe('fr')
    mockUserLanguage = 'en-US'
    act(() => tree.update(<PlanSelect />))
    expect(mockFilters.language).toBe('en')
    act(() =>
      mockHeader.filters
        .find(filter => filter.key === 'language')!
        .options!.find(option => option.key === 'all')!
        .onSelect()
    )
    act(() => tree.update(<PlanSelect />))
    expect(mockFilters.language).toBe('all')
    act(() => mockHeader.onReset())
    act(() => tree.update(<PlanSelect />))
    expect(mockFilters).toEqual({ query: '', language: 'en' })
    mockParams = { language: 'fr', search: 'prière' }
    act(() => tree.update(<PlanSelect />))
    expect(mockFilters).toEqual({ query: 'prière', language: 'fr' })
  } finally {
    act(() => tree?.unmount())
  }
})
