import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import DailyReadingSourceScreen from '../DailyReadingSourceScreen'

let mockParams: { language?: string } = {}
let mockLanguage = 'fr'
let mockSections: { key: string }[] = []
let mockFilters!: {
  onReset: () => void
  filters: { options: { key: string; onSelect: () => void }[] }[]
}
const mockRouter = {
  setParams: (params: typeof mockParams) => {
    mockParams = params
  },
  push: () => {},
}
const mockState = {
  user: { bible: { settings: { dailyMeditationId: null } } },
  plan: {
    onlineStatus: 'Resolved',
    myPlans: [],
    onlinePlans: [
      { id: 'fr', title: 'Recueil français', lang: 'fr', kind: 'daily-meditation' },
      { id: 'en', title: 'English collection', lang: 'en', kind: 'daily-meditation' },
    ],
  },
}
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  Redirect: () => null,
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: mockLanguage } }),
}))
jest.mock('react-redux', () => ({
  useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
  useDispatch: () => () => {},
}))
jest.mock('~redux/selectors/plan', () => ({
  selectSortedOnlinePlans: (state: typeof mockState) => state.plan.onlinePlans,
}))
jest.mock('~redux/modules/plan', () => ({ fetchPlans: () => ({ type: 'fetchPlans' }) }))
jest.mock('~redux/modules/user', () => ({
  setDailyMeditation: () => ({ type: 'setDailyMeditation' }),
}))
jest.mock('../useCollectionChoice', () => ({ useCollectionChoice: () => ({}) }))
jest.mock('~features/plans/plan.hooks', () => ({ useFireStorage: () => undefined }))
jest.mock('expo-image', () => ({ Image: () => null }))
jest.mock('react-native', () => ({
  ActivityIndicator: () => null,
  SectionList: ({ sections }: { sections: typeof mockSections }) => {
    mockSections = sections
    return null
  },
}))
jest.mock('~common/FiltersHeader', () => ({
  __esModule: true,
  default: (props: typeof mockFilters) => {
    mockFilters = props
    return null
  },
}))
jest.mock('~common/Header', () => ({
  __esModule: true,
  default: ({ rightComponent }: { rightComponent: React.ReactNode }) => rightComponent,
}))
jest.mock('~common/Link', () => ({ __esModule: true, default: () => null }))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Container', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Button', () => ({ __esModule: true, default: () => null }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: () => null }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/PageContent', () => ({ pageContentStyle: {} }))
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('defaults collections to the user language and keeps the standalone reading available', () => {
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(<DailyReadingSourceScreen />)
    })
    expect(mockSections.map(section => section.key)).toEqual(['standalone', 'fr'])
    act(() => {
      mockFilters.filters[0].options.find(option => option.key === 'en')!.onSelect()
      tree.update(<DailyReadingSourceScreen />)
    })
    expect(mockParams.language).toBe('en')
    expect(mockSections.map(section => section.key)).toEqual(['standalone', 'en'])
    act(() => {
      mockFilters.onReset()
      tree.update(<DailyReadingSourceScreen />)
    })
    expect(mockSections.map(section => section.key)).toEqual(['standalone', 'fr'])
    mockParams = {}
    mockLanguage = 'en-US'
    act(() => tree.update(<DailyReadingSourceScreen />))
    expect(mockSections.map(section => section.key)).toEqual(['standalone', 'en'])
    act(() => {
      mockFilters.filters[0].options.find(option => option.key === 'all')!.onSelect()
      tree.update(<DailyReadingSourceScreen />)
    })
    expect(mockSections.map(section => section.key)).toEqual(['standalone', 'fr', 'en'])
  } finally {
    act(() => tree?.unmount())
  }
})
