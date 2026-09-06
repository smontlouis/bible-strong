import type { TextProps } from '../Text'
import React from 'react'
import type { View } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import Box, { HStack, VStack, SafeAreaBox, type BoxProps } from '../Box'

// Metro compiles classes; this test covers our composition and ref contract.
jest.mock('uniwind', () => ({
  useResolveClassNames: (classes: string) =>
    Object.assign(
      {},
      ...classes.split(' ').map(name => {
        const styles: Record<string, object> = {
          'flex-row': { flexDirection: 'row' },
          'flex-col': { flexDirection: 'column' },
          'p-4': { padding: 16 },
        }
        return styles[name]
      })
    ),
}))
jest.mock('react-native', () => ({ View: 'View', TouchableOpacity: 'TouchableOpacity' }))
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
  Object.assign({}, ...renderer.root.findByType('View' as React.ElementType).props.style)

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
    expect(flattenedStyle(renderer).flexDirection).toBe('row')
    expect(ref.current).toBe(nativeView)
    act(() => renderer.update(<HStack testID="stack" className="flex-col" />))
    expect(flattenedStyle(renderer).flexDirection).toBe('column')
    act(() => renderer.update(<VStack testID="stack" />))
    expect(flattenedStyle(renderer).flexDirection).toBe('column')
    expect(renderer.root.findByType('View' as React.ElementType).props.testID).toBe('stack')
  })

  it('forwards caller classes through the safe-area variant', () => {
    act(() => {
      renderer = create(<SafeAreaBox className="p-4" />)
    })
    expect(flattenedStyle(renderer).padding).toBe(16)
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
    expect(flattenedStyle(renderer).padding).toBe(16)
    act(() => renderer.update(<Box />))
    expect(flattenedStyle(renderer)).toEqual({})
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
