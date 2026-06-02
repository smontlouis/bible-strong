import React, { forwardRef } from 'react'
import { StyleSheet, TextInput, View, useWindowDimensions, type ViewProps } from 'react-native'
import { FlashList, type FlashListProps } from '@shopify/flash-list'
import { TrueSheet, TrueSheetProvider, type TrueSheetProps } from '@lodev09/react-native-true-sheet'
import {
  BottomSheetModal as ExpoBottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFlatList,
  BottomSheetSectionList,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
  type BottomSheetHandleProps,
  type BottomSheetMethods,
  type BottomSheetProps as ExpoBottomSheetProps,
} from '@expo/ui/community/bottom-sheet'

type SheetDetent = NonNullable<TrueSheetProps['detents']>[number]

type CompatBottomSheetProps = Omit<
  ExpoBottomSheetProps,
  'backdropComponent' | 'footerComponent' | 'onChange'
> & {
  activeOffsetY?: unknown
  android_keyboardInputMode?: string
  animateOnMount?: boolean
  bottomInset?: number
  containerComponent?: React.ComponentType<{ children?: React.ReactNode }>
  backdropComponent?: React.ComponentType<any> | ((props: any) => React.ReactNode) | null
  detached?: boolean
  footerComponent?: React.ComponentType<any> | ((props: any) => React.ReactNode)
  handleComponent?: React.ComponentType<any> | null
  onAnimate?: (fromIndex: number, toIndex: number) => void
  onChange?: (index: number) => void
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

const snapPointToDetent = (snapPoint: string | number, screenHeight: number): SheetDetent => {
  if (typeof snapPoint === 'string' && snapPoint.endsWith('%')) {
    return Number(snapPoint.replace('%', '')) / 100
  }

  if (typeof snapPoint === 'number') {
    return snapPoint <= 1 ? snapPoint : snapPoint / screenHeight
  }

  return 0.5
}

const getDetents = (
  snapPoints: CompatBottomSheetProps['snapPoints'],
  enableDynamicSizing: CompatBottomSheetProps['enableDynamicSizing'],
  screenHeight: number
) => {
  if (snapPoints?.length) {
    return snapPoints.map(point => snapPointToDetent(point, screenHeight)).slice(0, 3)
  }

  return enableDynamicSizing
    ? (['auto'] satisfies SheetDetent[])
    : ([0.5, 1] satisfies SheetDetent[])
}

const findNearestDetentIndex = (detents: SheetDetent[], position: string | number) => {
  if (position === 'auto') {
    return detents.indexOf('auto')
  }

  const target = typeof position === 'number' ? position : Number(position.replace('%', '')) / 100
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  detents.forEach((detent, index) => {
    if (detent === 'auto') return
    const distance = Math.abs(detent - target)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

const TrueSheetCompat = forwardRef<BottomSheetMethods, CompatBottomSheetProps>((props, ref) => {
  const {
    backdropComponent,
    backgroundStyle,
    children,
    enableDynamicSizing,
    enablePanDownToClose,
    footerComponent,
    handleComponent,
    index = -1,
    onAnimate,
    onChange,
    onClose,
    onDismiss,
    snapPoints,
    style,
    topInset,
  } = props
  const { height } = useWindowDimensions()
  const sheetRef = React.useRef<TrueSheet>(null)
  const currentIndexRef = React.useRef(-1)
  const hasMountedRef = React.useRef(false)
  const detents = React.useMemo(
    () => getDetents(snapPoints, enableDynamicSizing, height),
    [enableDynamicSizing, height, snapPoints]
  )
  const presentIndex = Math.min(Math.max(index, 0), detents.length - 1)
  const maxContentHeight = topInset ? height - topInset : undefined
  const resolvedBackgroundStyle = StyleSheet.flatten(backgroundStyle)
  const resolvedSheetStyle = StyleSheet.flatten(style)
  const dimmed = Boolean(backdropComponent)

  React.useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (nextIndex: number) => {
        if (nextIndex === -1) {
          sheetRef.current?.dismiss()
          return
        }
        const clampedIndex = Math.min(Math.max(nextIndex, 0), detents.length - 1)
        if (currentIndexRef.current === -1) {
          sheetRef.current?.present(clampedIndex)
        } else {
          sheetRef.current?.resize(clampedIndex)
        }
      },
      snapToPosition: (position: string | number) => {
        const nextIndex = findNearestDetentIndex(detents, position)
        if (currentIndexRef.current === -1) {
          sheetRef.current?.present(nextIndex)
        } else {
          sheetRef.current?.resize(nextIndex)
        }
      },
      expand: () => {
        const nextIndex = detents.length - 1
        if (currentIndexRef.current === -1) {
          sheetRef.current?.present(nextIndex)
        } else {
          sheetRef.current?.resize(nextIndex)
        }
      },
      collapse: () => {
        if (currentIndexRef.current === -1) {
          sheetRef.current?.present(0)
        } else {
          sheetRef.current?.resize(0)
        }
      },
      close: () => sheetRef.current?.dismiss(),
      forceClose: () => sheetRef.current?.dismiss(),
      present: () => sheetRef.current?.present(presentIndex),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [detents, presentIndex]
  )

  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }

    if (index < 0) {
      sheetRef.current?.dismiss()
    } else if (currentIndexRef.current === -1) {
      sheetRef.current?.present(presentIndex)
    } else {
      sheetRef.current?.resize(presentIndex)
    }
  }, [index, presentIndex])

  return (
    <TrueSheet
      ref={sheetRef}
      detents={detents}
      dismissible={enablePanDownToClose ?? false}
      dimmed={dimmed}
      draggable
      footer={
        footerComponent
          ? React.createElement(footerComponent as React.ComponentType<any>)
          : undefined
      }
      grabber={handleComponent !== null}
      cornerRadius={
        typeof resolvedSheetStyle?.borderTopLeftRadius === 'number'
          ? resolvedSheetStyle.borderTopLeftRadius
          : undefined
      }
      maxContentHeight={maxContentHeight}
      maxContentWidth={
        typeof resolvedSheetStyle?.maxWidth === 'number' ? resolvedSheetStyle.maxWidth : undefined
      }
      scrollable={!enableDynamicSizing}
      backgroundColor={resolvedBackgroundStyle?.backgroundColor}
      onWillPresent={event => {
        onAnimate?.(currentIndexRef.current, event.nativeEvent.index)
      }}
      onDidPresent={event => {
        currentIndexRef.current = event.nativeEvent.index
        onChange?.(event.nativeEvent.index)
      }}
      onDetentChange={event => {
        currentIndexRef.current = event.nativeEvent.index
        onChange?.(event.nativeEvent.index)
      }}
      onWillDismiss={() => {
        onAnimate?.(currentIndexRef.current, -1)
      }}
      onDidDismiss={() => {
        currentIndexRef.current = -1
        onChange?.(-1)
        onClose?.()
        onDismiss?.()
      }}
    >
      {children}
    </TrueSheet>
  )
})
TrueSheetCompat.displayName = 'TrueSheetCompat'

const BottomSheet = TrueSheetCompat
BottomSheet.displayName = 'BottomSheet'

const BottomSheetModal = TrueSheetCompat
BottomSheetModal.displayName = 'BottomSheetModal'

export type BottomSheet = BottomSheetMethods
export type BottomSheetModal = BottomSheetMethods
export type BottomSheetProps = CompatBottomSheetProps
const BottomSheetModalProvider = TrueSheetProvider
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
  ExpoBottomSheetModal,
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
