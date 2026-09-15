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
    ],
    myPlans: [],
    ongoingPlans: [{ id: 'active-en', status: 'Progress', readingSlices: {} }],
    onlineStatus: 'Resolved',
  },
}
jest.mock('react-redux', () => ({
  useSelector: (select: (state: typeof mockState) => unknown) => select(mockState),
  useDispatch: () => () => {},
}))
jest.mock('~redux/modules/plan', () => ({ fetchPlans: () => ({ type: 'fetchPlans' }) }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
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
}))
jest.mock('~common/ui/Button', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Text', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
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
