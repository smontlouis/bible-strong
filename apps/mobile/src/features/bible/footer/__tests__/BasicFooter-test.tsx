import React from 'react'
import { act, create } from 'react-test-renderer'

import BasicFooter from '../BasicFooter'

jest.mock('jotai/react', () => ({ useAtomValue: () => false }))
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}))
jest.mock(
  'src/state/app',
  () => ({
    isBibleOverlayOpenAtom: {},
    isFullScreenBibleAtom: {},
  }),
  { virtual: true }
)
jest.mock('~features/app-switcher/context/TabContext', () => ({
  useBottomBarHeightInTab: () => ({ bottomBarHeight: 0 }),
}))
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const host = (name: string) =>
    function Host({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(name, props, children)
    }

  return {
    AnimatedHStack: host('AnimatedHStack'),
    AnimatedTouchableBox: host('AnimatedTouchableBox'),
    TouchableBox: host('TouchableBox'),
  }
})
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('../AudioButton', () => () => null)

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('BasicFooter accessibility', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('labels chapter and playback controls and disables unavailable navigation', () => {
    let renderer: ReturnType<typeof create>

    act(() => {
      renderer = create(
        <BasicFooter
          onPlay={jest.fn()}
          onNextChapter={jest.fn()}
          isPlaying={false}
          hasError={false}
        />
      )
    })

    const previous = renderer!.root.findByProps({
      accessibilityLabel: 'accessibility.previousChapter',
    })
    const next = renderer!.root.findByProps({
      accessibilityLabel: 'accessibility.nextChapter',
    })
    const play = renderer!.root.findByProps({ accessibilityLabel: 'accessibility.playAudio' })

    expect(previous.props.accessibilityRole).toBe('button')
    expect(previous.props.accessibilityState).toEqual({ disabled: true })
    expect(next.props.accessibilityRole).toBe('button')
    expect(next.props.accessibilityState).toEqual({ disabled: false })
    expect(play.props.accessibilityRole).toBe('button')
  })
})
