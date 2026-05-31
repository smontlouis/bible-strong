import React, { forwardRef } from 'react'
import { TextInput, View, type ViewProps } from 'react-native'
import { FlashList, type FlashListProps } from '@shopify/flash-list'
import ExpoBottomSheet, {
  BottomSheetModal as ExpoBottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFlatList,
  BottomSheetSectionList,
  BottomSheetModalProvider,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
  type BottomSheetHandleProps,
  type BottomSheetMethods,
  type BottomSheetProps as ExpoBottomSheetProps,
} from '@expo/ui/community/bottom-sheet'

type CompatBottomSheetProps = Omit<
  ExpoBottomSheetProps,
  'backdropComponent' | 'footerComponent'
> & {
  activeOffsetY?: unknown
  android_keyboardInputMode?: string
  animateOnMount?: boolean
  bottomInset?: number
  containerComponent?: React.ComponentType<{ children?: React.ReactNode }>
  backdropComponent?: React.ComponentType<any> | ((props: any) => React.ReactNode)
  detached?: boolean
  footerComponent?: React.ComponentType<any> | ((props: any) => React.ReactNode)
  handleComponent?: React.ComponentType<any> | null
  onAnimate?: (fromIndex: number, toIndex: number) => void
  keyboardBehavior?: string
  keyboardBlurBehavior?: string
  stackBehavior?: string
  topInset?: number
}

type CompatBackdropProps = BottomSheetBackdropProps & {
  appearsOnIndex?: number
  disappearsOnIndex?: number
  opacity?: number
  pressBehavior?: 'none' | 'close' | 'collapse' | number
}

type CompatFooterProps = BottomSheetFooterProps & {
  bottomInset?: number
  children?: React.ReactNode
  style?: ViewProps['style']
}

const stripUnsupportedProps = ({
  activeOffsetY: _activeOffsetY,
  android_keyboardInputMode: _androidKeyboardInputMode,
  animateOnMount: _animateOnMount,
  bottomInset: _bottomInset,
  containerComponent: _containerComponent,
  detached: _detached,
  keyboardBehavior: _keyboardBehavior,
  keyboardBlurBehavior: _keyboardBlurBehavior,
  onAnimate: _onAnimate,
  stackBehavior: _stackBehavior,
  topInset: _topInset,
  ...props
}: CompatBottomSheetProps) => props

const BottomSheet = forwardRef<BottomSheetMethods, CompatBottomSheetProps>((props, ref) => (
  <ExpoBottomSheet ref={ref} {...stripUnsupportedProps(props)} />
))
BottomSheet.displayName = 'BottomSheet'

const BottomSheetModal = forwardRef<BottomSheetMethods, CompatBottomSheetProps>((props, ref) => (
  <ExpoBottomSheetModal ref={ref} {...stripUnsupportedProps(props)} />
))
BottomSheetModal.displayName = 'BottomSheetModal'

export type BottomSheet = BottomSheetMethods
export type BottomSheetModal = BottomSheetMethods
export type BottomSheetProps = CompatBottomSheetProps
type BottomSheetDefaultBackdropProps = CompatBackdropProps

const BottomSheetFooter = ({ children, bottomInset = 0, style }: CompatFooterProps) => (
  <View style={[style, bottomInset ? { paddingBottom: bottomInset } : null]}>{children}</View>
)

const BottomSheetHandle = ({
  children,
  style,
}: BottomSheetHandleProps & { children?: React.ReactNode; style?: ViewProps['style'] }) => (
  <View style={style}>{children}</View>
)

const BottomSheetBackdrop = (_props: CompatBackdropProps) => null

const BottomSheetTextInput = TextInput

const BottomSheetFlashList = <T,>({
  estimatedItemSize: _estimatedItemSize,
  ...props
}: FlashListProps<T> & { estimatedItemSize?: number }) => <FlashList {...props} />

type KeyboardState = { target?: number }

const useBottomSheetInternal = () => ({
  animatedKeyboardState: {
    get: (): KeyboardState => ({}),
    set: (_value: KeyboardState | ((state: KeyboardState) => KeyboardState)) => {},
  },
})

export default BottomSheet

export {
  BottomSheet,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFlatList,
  BottomSheetFlashList,
  BottomSheetSectionList,
  BottomSheetTextInput,
  BottomSheetFooter,
  BottomSheetHandle,
  BottomSheetBackdrop,
  useBottomSheetInternal,
}

export type {
  BottomSheetBackdropProps,
  BottomSheetDefaultBackdropProps,
  BottomSheetFooterProps,
  BottomSheetHandleProps,
  BottomSheetMethods,
}
