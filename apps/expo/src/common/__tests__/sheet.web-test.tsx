import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { Sheet, type SheetRef } from '../sheet.web'

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    FlatList: 'FlatList',
    Modal: ({ children, visible }: React.PropsWithChildren<{ visible: boolean }>) =>
      visible ? ReactModule.createElement('Modal', {}, children) : null,
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    SectionList: 'SectionList',
    TextInput: 'TextInput',
    View: 'View',
    useWindowDimensions: () => ({ width: 1200, height: 800 }),
  }
})

jest.mock('@emotion/react', () => ({
  Global: () => null,
  useTheme: () => ({ colors: { reverse: '#fff', border: '#ddd' } }),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('@expo/ui/community/bottom-sheet', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const BottomSheetModal = ReactModule.forwardRef(
    (
      {
        accessibilityDescription,
        accessibilityLabel,
        backdropComponent,
        children,
        onClose,
      }: React.PropsWithChildren<{
        accessibilityDescription?: string
        accessibilityLabel?: string
        backdropComponent?: React.ComponentType | null
        onClose?: () => void
      }>,
      ref
    ) => {
      const [visible, setVisible] = ReactModule.useState(false)
      const close = () => {
        setVisible(false)
        onClose?.()
      }
      ReactModule.useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
        snapToIndex: () => setVisible(true),
        dismiss: close,
        close,
        forceClose: close,
      }))
      return visible
        ? ReactModule.createElement(
            'ExpoBottomSheet',
            { backdropComponent },
            ReactModule.createElement('DrawerTitle', {}, accessibilityLabel),
            ReactModule.createElement('DrawerDescription', {}, accessibilityDescription),
            children
          )
        : null
    }
  )

  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetModalProvider: ({ children }: React.PropsWithChildren) => children,
    BottomSheetView: 'BottomSheetView',
    BottomSheetScrollView: 'BottomSheetScrollView',
    BottomSheetFlatList: 'BottomSheetFlatList',
    BottomSheetSectionList: 'BottomSheetSectionList',
    BottomSheetTextInput: 'BottomSheetTextInput',
  }
})
jest.mock('~common/Back', () => () => null)
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Box = ReactModule.forwardRef(({ children }: React.PropsWithChildren, _ref) =>
    ReactModule.createElement('Box', {}, children)
  )
  return { __esModule: true, default: Box, TouchableBox: Box, FadingText: Box }
})
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))

describe('Sheet on web', () => {
  it('opens and closes through its public imperative API', () => {
    const ref = React.createRef<SheetRef>()
    const onOpenChange = jest.fn()
    const onDismissStart = jest.fn()
    const onDismiss = jest.fn()
    let renderer: ReactTestRenderer
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    act(() => {
      renderer = create(
        <Sheet
          ref={ref}
          onOpenChange={onOpenChange}
          onDismissStart={onDismissStart}
          onDismiss={onDismiss}
        >
          <span>Sheet content</span>
        </Sheet>
      )
    })
    expect(renderer!.root.findAll(node => String(node.type) === 'ExpoBottomSheet')).toHaveLength(0)

    act(() => ref.current?.present())
    expect(renderer!.root.findAll(node => String(node.type) === 'ExpoBottomSheet')).toHaveLength(1)
    expect(renderer!.root.findAll(node => String(node.type) === 'DrawerTitle')).toHaveLength(1)
    expect(renderer!.root.findAll(node => String(node.type) === 'DrawerDescription')).toHaveLength(
      1
    )
    expect(onOpenChange).toHaveBeenLastCalledWith(true)

    act(() => ref.current?.dismiss())
    expect(renderer!.root.findAll(node => String(node.type) === 'ExpoBottomSheet')).toHaveLength(0)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(onDismissStart).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    act(() => renderer!.unmount())
  })

  it('keeps the background interactive when the backdrop is disabled', () => {
    const ref = React.createRef<SheetRef>()
    let renderer: ReactTestRenderer

    act(() => {
      renderer = create(
        <Sheet ref={ref} backdrop={false}>
          <span>Interactive background sheet</span>
        </Sheet>
      )
    })
    act(() => ref.current?.present())

    expect(
      renderer!.root.find(node => String(node.type) === 'ExpoBottomSheet').props.backdropComponent
    ).toBeNull()

    act(() => renderer!.unmount())
  })
})
