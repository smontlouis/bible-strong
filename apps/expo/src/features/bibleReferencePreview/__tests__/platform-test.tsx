import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { Platform } from 'react-native'
import { useReferencePreview } from '../state'

const mockSetHistory = jest.fn()
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))
jest.mock('jotai/react', () => ({
  useSetAtom: () => mockSetHistory,
  useAtomValue: () => undefined,
}))
jest.mock('~state/tabs', () => ({ activeTabIndexAtom: {}, tabsAtom: {} }))
jest.mock('~state/resourcesLanguage', () => ({
  useResourcesLanguageValue: () => ({ STRONG: 'fr' }),
}))
jest.mock('~state/useDefaultBibleVersion', () => ({ useDefaultBibleVersion: () => 'LSG' }))
jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => 'fr',
  default: { t: (key: string) => key },
}))

it.each(['ios', 'android', 'web'] as const)(
  'restricts every editorial preview type on %s',
  platform => {
    Platform.OS = platform
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    mockSetHistory.mockClear()
    const open = jest.fn()
    function Harness() {
      const preview = useReferencePreview()
      return React.createElement('trigger', {
        onPress: (href: string) => {
          if (
            !preview(
              { href, type: '' },
              open,
              undefined,
              href.startsWith('w=')
                ? { kind: 'nave', language: 'fr' }
                : { kind: 'dictionary', work: 'bost', dictionaryTitle: 'Bost', language: 'fr' }
            )
          )
            open()
        },
      })
    }
    let view!: ReactTestRenderer
    act(() => {
      view = create(<Harness />)
    })
    for (const href of ['bible://John.3.16', 'strong://G0026', 'Apollyon', 'w=amour']) {
      act(() => view.root.findByType('trigger' as React.ElementType).props.onPress(href))
    }
    expect(mockSetHistory).toHaveBeenCalledTimes(platform === 'web' ? 4 : 0)
    expect(open).toHaveBeenCalledTimes(platform === 'web' ? 0 : 4)
    act(() => view.unmount())
  }
)
