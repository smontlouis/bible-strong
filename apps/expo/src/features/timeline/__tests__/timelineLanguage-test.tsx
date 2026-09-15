import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { atom, createStore } from 'jotai/vanilla'
import { Provider } from 'jotai/react'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import TimelineItem from '../TimelineItem'
import { useTimelineTranslation } from '../useTimelineLanguage'

const mockResourceLanguages = atom({ TIMELINE: 'fr' as ResourceLanguage })
jest.mock('~state/resourcesLanguage', () => ({
  useResourcesLanguageValue: () =>
    jest.requireActual('jotai/react').useAtomValue(mockResourceLanguages),
}))
jest.mock('~helpers/useLanguage', () => ({ __esModule: true, default: () => 'fr' }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'fr',
      getFixedT: (language: string) => (key: string) => `${language}:${key}`,
    },
  }),
}))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({ fontFamily: { title: 'System' } }),
}))
jest.mock('~themes/styleValues', () => ({
  resolveThemeColor: (_theme: unknown, color: string) => color,
  resolveFontFamily: () => 'System',
}))
jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => React.createElement('Box', props) }
})
jest.mock('~common/ui/Text', () => {
  const React = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => React.createElement('Text', props) }
})
jest.mock('~common/Link', () => ({ __esModule: true, default: () => null }))
jest.mock('expo-image', () => ({ Image: () => null }))
jest.mock('../timelinePeriodImages', () => ({ getTimelinePeriodImageSource: () => undefined }))

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('updates sections and date labels with the resource language while the app stays French', () => {
  const store = createStore()
  const period = {
    id: 'first-generation',
    image: '',
    color: 'red',
    startYear: -4000,
    endYear: -2500,
    interval: 100,
    title: 'Première génération',
    titleEn: 'First Generation',
    sectionTitle: 'L’ère des patriarches',
    sectionTitleEn: 'Age of Patriarchs',
    subTitle: 'Création - 2500 avant J.-C.',
    subTitleEn: 'Creation - 2500 B.C.',
    description: '',
    descriptionEn: '',
    events: [],
  }
  function DateProbe() {
    const { t } = useTimelineTranslation()
    return <>{t('Futur')}</>
  }
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(
        <Provider store={store}>
          <TimelineItem {...period} goTo={0} />
          <DateProbe />
        </Provider>
      )
    })
    expect(JSON.stringify(tree.toJSON())).toContain('Première génération')
    act(() => store.set(mockResourceLanguages, { TIMELINE: 'en' }))
    const english = JSON.stringify(tree.toJSON())
    expect(english).toContain('First Generation')
    expect(english).toContain('Age of Patriarchs')
    expect(english).toContain('Creation - 2500 B.C.')
    expect(english).toContain('en:Futur')
    expect(english).not.toContain('Première génération')
    act(() => store.set(mockResourceLanguages, { TIMELINE: 'fr' }))
    expect(JSON.stringify(tree.toJSON())).toContain('Première génération')
  } finally {
    act(() => tree?.unmount())
  }
})
