import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import ReadingPlansScreen from '../ReadingPlansScreen'

const mockState = {
  plan: {
    onlinePlans: [
      { id: 'active-en', title: 'My English plan', lang: 'en', kind: 'reading-plan', duration: 10 },
      {
        id: 'discover-fr',
        title: 'Découvrir la Bible',
        lang: 'fr',
        kind: 'reading-plan',
        duration: 10,
      },
      {
        id: 'discover-en',
        title: 'Discover the Bible',
        lang: 'en',
        kind: 'reading-plan',
        duration: 10,
      },
      { id: 'done-fr', title: 'Lire Jacques', lang: 'fr', kind: 'reading-plan', duration: 5 },
    ],
    myPlans: [],
    ongoingPlans: [
      { id: 'active-en', status: 'Progress', readingSlices: {} },
      { id: 'done-fr', status: 'Completed', readingSlices: {} },
    ],
    onlineStatus: 'Resolved',
  },
}
jest.mock('react-redux', () => ({
  useSelector: (select: (state: typeof mockState) => unknown) => select(mockState),
  useDispatch: () => () => {},
}))
jest.mock('~redux/modules/plan', () => ({
  fetchPlans: () => ({ type: 'fetchPlans' }),
  resetPlan: () => ({ type: 'reset' }),
  startPlan: () => ({ type: 'start' }),
}))
jest.mock('~common/ConfirmDialog/useConfirmDialog', () => ({ useConfirmDialog: () => () => {} }))
jest.mock('~features/daily-reading/useDailyMeditation', () => ({
  useLocalReadingDate: () => '2026-09-14',
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: () => {} }) }))
jest.mock('expo-image', () => ({ Image: () => null }))
jest.mock('../plan.hooks', () => ({ useFireStorage: () => undefined }))
jest.mock('react-native', () => ({
  ActivityIndicator: () => null,
  ScrollView: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/Link', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
  usePageBottomInset: () => 0,
}))
jest.mock('~common/ui/Button', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Text', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null, IonIcon: () => null }))
jest.mock('~common/ui/ListSection', () => ({
  __esModule: true,
  default: ({ title, children }: React.PropsWithChildren<{ title?: string }>) => [title, children],
}))
jest.mock('~common/ui/PageContent', () => ({ pageContentStyle: {} }))
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('filters only discovery and leaves participating plans visible in every language', () => {
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(<ReadingPlansScreen filters={{ language: 'fr', query: '' }} />)
    })
    const first = JSON.stringify(tree.toJSON())
    expect(first).toContain('My English plan')
    expect(first).toContain('Découvrir la Bible')
    expect(first).not.toContain('Discover the Bible')
    act(() => tree.update(<ReadingPlansScreen filters={{ language: 'fr', query: 'inexistant' }} />))
    const filtered = JSON.stringify(tree.toJSON())
    expect(filtered).toContain('My English plan')
    expect(filtered).not.toContain('Découvrir la Bible')
    expect(filtered).toContain('readingPlans.noMatchingPlans')
  } finally {
    act(() => tree?.unmount())
  }
})

it('lists a followed plan once, and a finished one under its own title', () => {
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(<ReadingPlansScreen filters={{ language: 'all', query: '' }} />)
    })
    const json = JSON.stringify(tree.toJSON())
    expect(json.split('My English plan')).toHaveLength(2)
    expect(json.split('Lire Jacques')).toHaveLength(2)
    expect(json.indexOf('readingPlans.completedPlans')).toBeLessThan(json.indexOf('Lire Jacques'))
    expect(json).toContain('Discover the Bible')
  } finally {
    act(() => tree?.unmount())
  }
})
