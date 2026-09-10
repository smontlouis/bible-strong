import type { TextProps } from '../Text'
import React from 'react'
import { Platform, type View } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import Box, { HStack, VStack, SafeAreaBox, type BoxProps } from '../Box'

// Metro compiles classes; this test covers our composition and ref contract.
jest.mock('react-native', () => ({
  View: 'View',
  TouchableOpacity: 'TouchableOpacity',
  Platform: { OS: 'ios' },
}))
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  Easing: { bezier: jest.fn() },
}))
jest.mock('@alloc/moti', () => ({ motify: (component: unknown) => () => component }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({}) }))
jest.mock('~features/app-switcher/context/TabContext', () => ({
  useBottomBarHeightInTab: () => ({ bottomBarHeight: 0 }),
}))
jest.mock('../Text', () => ({ __esModule: true, default: 'Text', AnimatedText: 'Text' }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({ colors: { border: '#253e51', reverse: '#122d42' } }),
}))

const flattenedStyle = (renderer: ReactTestRenderer) =>
  renderer.root.findByType('View' as React.ElementType).props.style ?? {}

const classes = (renderer: ReactTestRenderer) =>
  renderer.root.findByType('View' as React.ElementType).props.className ?? ''

describe('layout primitives', () => {
  let renderer: ReactTestRenderer
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(() => act(() => renderer.unmount()))

  it('keeps stack defaults overridable and forwards native props and refs', () => {
    const ref = React.createRef<View>()
    const nativeView = { measure: jest.fn() }
    act(() => {
      renderer = create(<HStack testID="stack" ref={ref} />, {
        createNodeMock: () => nativeView,
      })
    })
    expect(classes(renderer)).toBe('flex-row')
    expect(ref.current).toBe(nativeView)
    act(() => renderer.update(<HStack testID="stack" className="flex-col" />))
    expect(classes(renderer)).toBe('flex-col')
    act(() => renderer.update(<VStack testID="stack" />))
    expect(classes(renderer)).toBe('flex-col')
    expect(renderer.root.findByType('View' as React.ElementType).props.testID).toBe('stack')
  })

  it('forwards classes and styles through a custom as component', () => {
    const Custom = (props: BoxProps) => <Box {...props} />
    const style = { padding: 24 }
    act(() => {
      renderer = create(<Box as={Custom} className="p-4" style={style} />)
    })
    expect(classes(renderer)).toBe('p-4')
    expect(flattenedStyle(renderer)).toBe(style)
  })

  it('forwards caller classes through the safe-area variant', () => {
    act(() => {
      renderer = create(<SafeAreaBox className="p-4" />)
    })
    expect(classes(renderer).split(' ')).toContain('p-4')
  })

  it('forwards focus-group metadata on web without sending web-only props to native views', () => {
    act(() => {
      renderer = create(<Box dataSet={{ focusGroup: 'true' }} />)
    })
    expect(renderer.root.findByType('View' as React.ElementType).props.dataSet).toBeUndefined()
    const platform = jest.replaceProperty(Platform, 'OS', 'web')
    try {
      act(() => renderer.update(<Box dataSet={{ focusGroup: 'true' }} />))
      expect(renderer.root.findByType('View' as React.ElementType).props.dataSet).toEqual({
        focusGroup: 'true',
      })
    } finally {
      platform.restore()
    }
  })

  it('lets explicit styles override classes and has no implicit layout styles', () => {
    act(() => {
      renderer = create(
        <Box className="p-4" style={{ padding: 24, backgroundColor: 'rgba(37, 62, 81, 0.3)' }} />
      )
    })
    expect(flattenedStyle(renderer)).toMatchObject({
      padding: 24,
      backgroundColor: 'rgba(37, 62, 81, 0.3)',
    })
    act(() => renderer.update(<Box className="p-4" />))
    expect(classes(renderer).split(' ')).toContain('p-4')
    act(() => renderer.update(<Box />))
    expect(flattenedStyle(renderer)).toEqual({})
    expect(classes(renderer)).toBe('')
  })
})

// Compile-time guard: the primitive must not regain a legacy styling API.
type AssertNever<T extends never> = T
export type NoLegacyBoxStyles = AssertNever<
  Extract<keyof BoxProps, 'p' | 'bg' | 'bgOpacity' | 'height' | 'width' | 'center' | 'row' | 'size'>
>

export type NoLegacyTextStyles = AssertNever<
  Extract<keyof TextProps, 'p' | 'bg' | 'color' | 'fontSize' | 'bold' | 'title' | 'row'>
>
