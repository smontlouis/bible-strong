import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { atom, createStore } from 'jotai/vanilla'
import { Provider } from 'jotai/react'
import type { ResourceLanguage } from '~helpers/databaseTypes'
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

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('writes the date labels in the resource language while the app stays French', () => {
  const store = createStore()
  function DateProbe() {
    const { t } = useTimelineTranslation()
    return <>{t('Futur')}</>
  }
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(
        <Provider store={store}>
          <DateProbe />
        </Provider>
      )
    })
    expect(JSON.stringify(tree.toJSON())).toContain('fr:Futur')
    act(() => store.set(mockResourceLanguages, { TIMELINE: 'en' }))
    expect(JSON.stringify(tree.toJSON())).toContain('en:Futur')
  } finally {
    act(() => tree?.unmount())
  }
})
