import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { Sheet, type SheetRef } from '../sheet'

const mockNativeDismiss = jest.fn(() => Promise.resolve())
const mockNativePresent = jest.fn(() => Promise.resolve())
let mockNativeSheetProps: Record<string, (...args: never[]) => void> = {}

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }))
jest.mock('react-native', () => ({
  FlatList: 'FlatList',
  Platform: { OS: 'ios' },
  ScrollView: 'ScrollView',
  SectionList: 'SectionList',
  TextInput: 'TextInput',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}))
jest.mock('@emotion/react', () => ({
  useTheme: () => ({ colors: { reverse: '#fff', default: '#000' } }),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('~common/Back', () => () => null)
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Box = ReactModule.forwardRef(({ children }: React.PropsWithChildren, _ref) =>
    ReactModule.createElement('Box', {}, children)
  )
  return { __esModule: true, default: Box, TouchableBox: Box, FadingText: Box }
})
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) =>
      ReactModule.createElement('Text', {}, children),
  }
})

jest.mock('@lodev09/react-native-true-sheet', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const TrueSheet = ReactModule.forwardRef(
    (props: Record<string, (...args: never[]) => void> & { children?: React.ReactNode }, ref) => {
      mockNativeSheetProps = props
      ReactModule.useImperativeHandle(ref, () => ({
        present: mockNativePresent,
        resize: jest.fn(() => Promise.resolve()),
        dismiss: mockNativeDismiss,
      }))
      return props.children
    }
  )

  return {
    TrueSheet,
    TrueSheetProvider: ({ children }: React.PropsWithChildren) => children,
  }
})

describe('Sheet lifecycle commands', () => {
  let renderer: ReactTestRenderer
  const sheetRef = React.createRef<SheetRef>()

  beforeEach(() => {
    mockNativeDismiss.mockClear()
    mockNativePresent.mockClear()
    mockNativeDismiss.mockResolvedValue(undefined)
    mockNativePresent.mockResolvedValue(undefined)
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    act(() => {
      renderer = create(<Sheet ref={sheetRef} />)
    })
  })

  afterEach(() => {
    act(() => renderer.unmount())
  })

  it('forwards only the first dismiss while the sheet is closing', () => {
    act(() => mockNativeSheetProps.onDidPresent())
    act(() => {
      sheetRef.current?.dismiss()
      sheetRef.current?.dismiss()
    })

    expect(mockNativeDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss after the native sheet started closing itself', () => {
    act(() => mockNativeSheetProps.onDidPresent())
    act(() => mockNativeSheetProps.onWillDismiss())
    act(() => sheetRef.current?.dismiss())

    expect(mockNativeDismiss).not.toHaveBeenCalled()
  })

  it('allows presenting again after the native present command rejects', async () => {
    mockNativePresent.mockRejectedValueOnce(new Error('No presenting view controller found'))

    act(() => sheetRef.current?.present())
    await act(async () => {})
    act(() => sheetRef.current?.present())

    expect(mockNativePresent).toHaveBeenCalledTimes(2)
  })

  it('allows dismissing again after the native dismiss command rejects', async () => {
    act(() => mockNativeSheetProps.onDidPresent())
    mockNativeDismiss.mockRejectedValueOnce(new Error('No sheet found with tag 42'))

    act(() => sheetRef.current?.dismiss())
    await act(async () => {})
    act(() => sheetRef.current?.dismiss())

    expect(mockNativeDismiss).toHaveBeenCalledTimes(2)
  })
})
