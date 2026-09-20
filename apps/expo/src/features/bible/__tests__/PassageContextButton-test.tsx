import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import PassageContextButton from '../PassageContextButton'

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 30, bottom: 20 }),
}))
jest.mock('~features/app-switcher/utils/constants', () => ({
  HEADER_HEIGHT: 54,
  HEADER_HEIGHT_MIN: 20,
  BIBLE_FORM_SHEET_HEADER_HEIGHT: 54,
}))
jest.mock('~features/app-switcher/context/TabContext', () => ({
  useBottomBarHeightInTab: () => ({ bottomBarHeight: 80 }),
}))
jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual('react')
  return {
    __esModule: true,
    default: (props: object) => React.createElement('Box', props),
    AnimatedBox: (props: object) => React.createElement('AnimatedBox', props),
    TouchableBox: (props: object) => React.createElement('Button', props),
  }
})
jest.mock('~common/ui/Text', () => {
  const React = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => React.createElement('Text', props) }
})
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
let mockFullScreen = false
let mockPublicShell = false
jest.mock('~navigation/PublicShellContext', () => ({
  usePublicShell: () => ({ active: mockPublicShell }),
}))
jest.mock('~state/app', () => ({ isFullScreenBibleAtom: {} }))
jest.mock('jotai/react', () => ({ useAtomValue: () => mockFullScreen }))
beforeEach(() => {
  mockFullScreen = false
  mockPublicShell = false
})
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('slides away with fullscreen and restores without changing the sheet header', () => {
  const render = (isFormSheet = false) => (
    <PassageContextButton
      focused={false}
      isFormSheet={isFormSheet}
      onExpand={() => {}}
      onCollapse={() => {}}
      onExit={() => {}}
    />
  )
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(render())
    })
    const header = () => tree.root.findByType('AnimatedBox' as React.ElementType).props
    expect(header().style.opacity).toBe(1)
    mockFullScreen = true
    act(() => tree.update(render()))
    expect(header().pointerEvents).toBe('none')
    expect(header().style.transform).toEqual([{ translateY: -78 }])
    expect(header().style.opacity).toBe(0)
    act(() => tree.update(render(true)))
    expect(header().style.opacity).toBe(1)
    expect(header().pointerEvents).toBe('auto')
    mockFullScreen = false
    act(() => tree.update(render()))
    expect(header().style.transform).toEqual([{ translateY: 0 }])
  } finally {
    act(() => tree?.unmount())
  }
})

it('keeps both directions available without clearing the passage selection', () => {
  const onExpand = jest.fn()
  const onCollapse = jest.fn()
  const onExit = jest.fn()
  const render = (focused: boolean) => (
    <PassageContextButton
      focused={focused}
      isFormSheet
      onExpand={onExpand}
      onCollapse={onCollapse}
      onExit={onExit}
    />
  )
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(render(true))
    })
    expect(JSON.stringify(tree.toJSON())).toContain('tab.readWholeChapter')
    act(() => tree.root.findAllByType('Button' as React.ElementType)[0].props.onPress())
    expect(onExpand).toHaveBeenCalledTimes(1)
    act(() => tree.update(render(false)))
    expect(JSON.stringify(tree.toJSON())).toContain('tab.closeContext')
    act(() => tree.root.findAllByType('Button' as React.ElementType)[0].props.onPress())
    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(onExit).not.toHaveBeenCalled()
    act(() => tree.root.findAllByType('Button' as React.ElementType)[1].props.onPress())
    expect(onExit).toHaveBeenCalledTimes(1)
  } finally {
    act(() => tree?.unmount())
  }
})

it('renders the public chapter action as a contained button', () => {
  mockPublicShell = true
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(
        <PassageContextButton focused onExpand={() => {}} onCollapse={() => {}} onExit={() => {}} />
      )
    })
    const action = tree.root.findAllByType('Button' as React.ElementType)[0]
    expect(action.props.className).toContain('h-[36px]')
    expect(action.props.className).toContain('rounded-[12px]')
    expect(action.props.className).toContain('border-border')
    expect(action.props.className).not.toContain('border-primary')
    expect(action.props.className).not.toContain('flex-1 mx-[56px]')
    expect(tree.root.findAllByType('Button' as React.ElementType)).toHaveLength(1)
  } finally {
    act(() => tree?.unmount())
  }
})
