import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { createStore } from 'redux'
import { Provider } from 'react-redux'
import { Share } from 'react-native'
import { useRouter } from 'expo-router'
import type { Plan } from '~common/types'
import DailyMeditationCard from '../DailyMeditationCard'

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' },
  AppState: { addEventListener: () => ({ remove: jest.fn() }) },
  Share: { share: jest.fn(async () => ({})) },
}))
jest.mock('expo-router', () => ({ useRouter: jest.fn() }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('../../../../i18n', () => ({ getLanguage: () => 'fr' }))
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ isError: false, fetchStatus: 'idle', refetch: jest.fn() }),
}))
jest.mock('~redux/modules/plan', () => ({ fetchPlan: jest.fn() }))
jest.mock('~redux/selectors/user', () => ({
  selectFontFamily: (state: { user: { fontFamily: string } }) => state.user.fontFamily,
}))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: (font: string) => font }))
jest.mock('~common/Link', () => 'Link')
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('~features/plans/plan.hooks', () => ({ useFireStorage: () => 'cover.png' }))
jest.mock('~common/sheet', () => ({ SheetView: 'SheetView' }))
jest.mock('~common/ModalSheet', () => 'Sheet')
jest.mock('../ReminderSettings', () => 'ReminderSettings')
jest.mock('~redux/modules/user', () => ({ setNotificationVOD: jest.fn() }))
jest.mock('~common/ui/Box', () => 'Box')
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Paragraph', () => 'Paragraph')
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))

const collection: Plan = {
  id: 'daily-book',
  title: 'Un recueil',
  type: 'meditation',
  lang: 'fr',
  author: { id: 'author', displayName: 'Auteur', photoUrl: '' },
  sections: [
    {
      id: 'september',
      title: 'Septembre',
      subTitle: '',
      readingSlices: [
        {
          id: 'yesterday',
          title: 'Hier, 13 septembre',
          slices: [
            {
              id: 'opening',
              type: 'Text',
              subType: 'devotional',
              description: 'La parole est la vérité. Jean 17:17.\nAD 275.1',
            },
          ],
        },
        {
          id: 'today',
          title: 'Aujourd’hui, 14 septembre',
          slices: [
            {
              id: 'opening',
              type: 'Text',
              subType: 'devotional',
              description: 'Une autre citation. Psaume 23:1.',
            },
          ],
        },
      ],
    },
  ],
}

const store = createStore(() => ({
  user: { fontFamily: 'Chosen reading font', notifications: { verseOfTheDay: '' } },
  plan: { myPlans: [collection] },
}))
let renderer: ReactTestRenderer
const push = jest.fn()
const renderCard = (offset: number, fallback?: () => void) => {
  act(() => {
    renderer = create(
      <Provider store={store}>
        <DailyMeditationCard collectionId={collection.id} addDay={offset} onFallback={fallback} />
      </Provider>
    )
  })
}
const button = (label: string) =>
  renderer.root.find(
    node => String(node.type) === 'Link' && node.props.accessibilityLabel === label
  )

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date(2026, 8, 14, 12))
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  push.mockClear()
  jest.mocked(Share.share).mockClear()
})
afterEach(() => {
  if (renderer) act(() => renderer.unmount())
  jest.useRealTimers()
})

describe('daily meditation home card', () => {
  it('keeps the verse-card actions without an image action or a separate read button', () => {
    renderCard(0)
    const labels = renderer.root
      .findAll(node => String(node.type) === 'Link')
      .map(node => node.props.accessibilityLabel)
    expect(labels).toContain('Partager')
    expect(labels).toContain('Recevoir une notification quotidienne')
    expect(labels).not.toContain('dailyReading.read')
    expect(labels).not.toContain('accessibility.createVerseImage')
    expect(
      renderer.root.findAll(node => String(node.type) === 'Text').map(node => node.props.children)
    ).not.toContain('Un recueil')
    expect(renderer.root.find(node => String(node.type) === 'Image').props.source.uri).toBe(
      'cover.png'
    )
  })

  it('opens the displayed previous date, not today, using stable source identity', () => {
    renderCard(-1)
    act(() => button('La parole est la vérité. Jean 17:17.').props.onPress())
    expect(push).toHaveBeenCalledWith({
      pathname: '/meditation',
      params: { collectionId: 'daily-book', date: '2026-09-13' },
    })
  })

  it('separates the visible reference, honors the reading font and shares the displayed source', () => {
    renderCard(-1)
    const passage = renderer.root.find(node => String(node.type) === 'Paragraph')
    expect(passage.props.children).toBe('La parole est la vérité.')
    expect(passage.props.style.fontFamily).toBe('Chosen reading font')
    expect(
      renderer.root.findAll(node => String(node.type) === 'Text').map(node => node.props.children)
    ).toContain('Jean 17:17')
    act(() => button('Partager').props.onPress())
    expect(Share.share).toHaveBeenCalledWith({
      message: 'La parole est la vérité. Jean 17:17.\nUn recueil',
    })
  })

  it('exposes the full passage to accessibility even when the mobile preview is truncated', () => {
    renderCard(0)
    const link = button('Une autre citation. Psaume 23:1.')
    act(() => link.props.onPress())
    expect(push).toHaveBeenCalledWith({
      pathname: '/meditation',
      params: { collectionId: 'daily-book', date: '2026-09-14' },
    })
  })

  it('offers an explicit fallback for a missing date without changing the selected source', () => {
    const fallback = jest.fn()
    renderCard(-2, fallback)
    const fallbackLink = renderer.root.find(
      node => String(node.type) === 'Link' && node.props.onPress === fallback
    )
    act(() => fallbackLink.props.onPress())
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    expect(store.getState().plan.myPlans).toEqual([collection])
  })
})
