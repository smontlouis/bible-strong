import React, { forwardRef } from 'react'
import {
  FlatList,
  Platform,
  ScrollView,
  SectionList,
  TextInput,
  View,
  useWindowDimensions,
  type FlatListProps,
  type ScrollViewProps,
  type SectionListProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native'
import { TrueSheet, TrueSheetProvider, type TrueSheetProps } from '@lodev09/react-native-true-sheet'
import { FlashList, type FlashListProps } from '@shopify/flash-list'
import Back from '~common/Back'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text, { type TextProps } from '~common/ui/Text'
import { useTheme } from '@emotion/react'

export type SheetSnapPoint = NonNullable<TrueSheetProps['detents']>[number]
export type SheetScrollableOptions = NonNullable<TrueSheetProps['scrollableOptions']>
export type SheetStackBehavior = NonNullable<TrueSheetProps['stackBehavior']>

export type SheetRef = {
  present: () => void
  presentAt: (snapPoint: SheetSnapPoint) => void
  resizeTo: (snapPoint: SheetSnapPoint) => void
  dismiss: () => void
  close: () => void
  forceClose: () => void
}

export type SheetFooterProps = {
  bottomInset?: number
  children?: React.ReactNode
  style?: ViewProps['style']
}

export type SheetHeaderProps = {
  title?: string
  subTitle?: string
  children?: React.ReactNode
  centerTitle?: boolean
  hasBackButton?: boolean
  leftComponent?: React.ReactNode
  onBackPress?: () => void
  rightComponent?: React.ReactNode
}

export type SheetItemProps = TextProps & {
  children: string
  tag?: string | number
  onPress: () => void
}

export type SheetProps = {
  children?: React.ReactNode
  snapPoints?: SheetSnapPoint[]
  initialSnapPoint?: SheetSnapPoint
  detached?: boolean
  detachedOffset?: number
  scrollableOptions?: SheetScrollableOptions
  backdrop?: boolean
  backgroundColor?: string
  cornerRadius?: number
  maxWidth?: number
  header?: React.ReactElement | React.ComponentType<unknown>
  footer?: React.ComponentType<SheetFooterProps> | ((props: SheetFooterProps) => React.ReactNode)
  dismissible?: boolean
  stackBehavior?: SheetStackBehavior
  onClose?: () => void
  onDismiss?: () => void
  onOpenChange?: (isOpen: boolean) => void
  onPresent?: () => void
}

const getDetents = (snapPoints?: SheetSnapPoint[]) => {
  if (snapPoints?.length) return snapPoints.slice(0, 3)
  return ['auto'] satisfies SheetSnapPoint[]
}

const findSnapPointIndex = (snapPoints: SheetSnapPoint[], snapPoint: SheetSnapPoint) => {
  if (snapPoint === 'auto') return snapPoints.indexOf('auto')

  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  snapPoints.forEach((point, index) => {
    if (point === 'auto') return
    const distance = Math.abs(point - snapPoint)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

const SheetItem = ({ children, tag, onPress, ...props }: SheetItemProps) => (
  <TouchableBox
    onPress={onPress}
    row
    alignItems="center"
    justifyContent="space-between"
    p={20}
    borderColor="border"
    borderBottomWidth={1}
    overflow="hidden"
  >
    <Text {...props}>{children}</Text>
    {Boolean(tag) && (
      <Box ml={10} p={3} bg="lightGrey" borderRadius={3}>
        <Text fontSize={12} color="grey" reverse>
          {tag}
        </Text>
      </Box>
    )}
  </TouchableBox>
)

const Sheet = forwardRef<SheetRef, SheetProps>((props, ref) => {
  const {
    backdrop = true,
    backgroundColor,
    children,
    cornerRadius,
    detached,
    detachedOffset,
    dismissible = true,
    footer,
    header,
    initialSnapPoint,
    maxWidth,
    onClose,
    onDismiss,
    onOpenChange,
    onPresent,
    scrollableOptions,
    snapPoints,
    stackBehavior,
  } = props
  const { height } = useWindowDimensions()
  const sheetRef = React.useRef<TrueSheet>(null)
  const detents = getDetents(snapPoints)
  const initialDetentIndex = initialSnapPoint ? findSnapPointIndex(detents, initialSnapPoint) : 0
  const scrollable = !detents.includes('auto')
  const theme = useTheme()

  React.useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(initialDetentIndex),
      presentAt: snapPoint => sheetRef.current?.present(findSnapPointIndex(detents, snapPoint)),
      resizeTo: snapPoint => sheetRef.current?.resize(findSnapPointIndex(detents, snapPoint)),
      dismiss: () => sheetRef.current?.dismiss(),
      close: () => sheetRef.current?.dismiss(),
      forceClose: () => sheetRef.current?.dismiss(),
    }),
    [detents, initialDetentIndex]
  )

  return (
    <TrueSheet
      ref={sheetRef}
      detents={detents}
      dismissible={dismissible}
      dimmed={backdrop}
      draggable
      footer={
        footer ? React.createElement(footer as React.ComponentType<SheetFooterProps>) : undefined
      }
      header={header}
      grabber
      cornerRadius={cornerRadius}
      maxContentHeight={height}
      maxContentWidth={maxWidth}
      scrollable={scrollable}
      scrollableOptions={scrollableOptions}
      blurOptions={{
        intensity: 90,
      }}
      backgroundColor={
        backgroundColor || Platform.OS === 'android' ? theme.colors.reverse : undefined
      }
      detached={detached}
      detachedOffset={detachedOffset}
      stackBehavior={stackBehavior}
      onDidPresent={() => {
        onOpenChange?.(true)
        onPresent?.()
      }}
      onDidDismiss={() => {
        onOpenChange?.(false)
        onClose?.()
        onDismiss?.()
      }}
    >
      {children}
    </TrueSheet>
  )
})
Sheet.displayName = 'Sheet'

const SheetFooter = ({ children, bottomInset = 0, style }: SheetFooterProps) => (
  <View style={[style, bottomInset ? { paddingBottom: bottomInset } : null]}>{children}</View>
)

const SheetHeader = ({
  title,
  subTitle,
  children,
  centerTitle,
  hasBackButton,
  leftComponent,
  onBackPress,
  rightComponent,
}: SheetHeaderProps) => (
  <Box borderColor="border" borderBottomWidth={1}>
    {(title || subTitle || hasBackButton || leftComponent || rightComponent) && (
      <Box minH={54} row alignItems="center">
        {hasBackButton ? (
          <Back
            onCustomPress={onBackPress}
            style={{ width: 54, minHeight: 54, alignItems: 'center', justifyContent: 'center' }}
          >
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        ) : (
          leftComponent
        )}
        <Box
          flex
          paddingLeft={hasBackButton || leftComponent ? 0 : 20}
          paddingRight={rightComponent ? 0 : 20}
          justifyContent="center"
          alignItems={centerTitle ? 'center' : undefined}
        >
          {!!title && (
            <Text numberOfLines={1} bold fontSize={16} textAlign={centerTitle ? 'center' : 'left'}>
              {title}
            </Text>
          )}
          {!!subTitle && (
            <Text fontSize={13} color="grey" textAlign={centerTitle ? 'center' : 'left'}>
              {subTitle}
            </Text>
          )}
        </Box>
        {rightComponent}
      </Box>
    )}
    {children}
  </Box>
)

const SheetView = View
const SheetScrollView = ScrollView
const SheetFlatList = FlatList
const SheetSectionList = SectionList
const SheetTextInput = TextInput

const SheetFlashList = <T,>({
  estimatedItemSize: _estimatedItemSize,
  ...props
}: FlashListProps<T> & { estimatedItemSize?: number }) => <FlashList {...props} />

type KeyboardState = { target?: number }

const useSheetInternal = () => ({
  animatedKeyboardState: {
    get: (): KeyboardState => ({}),
    set: (_value: KeyboardState | ((state: KeyboardState) => KeyboardState)) => {},
  },
})

export default Sheet

export {
  Sheet,
  TrueSheetProvider as SheetProvider,
  SheetView,
  SheetScrollView,
  SheetFlatList,
  SheetFlashList,
  SheetSectionList,
  SheetTextInput,
  SheetFooter,
  SheetHeader,
  SheetItem,
  useSheetInternal,
}

export type {
  FlatListProps as SheetFlatListProps,
  FlashListProps as SheetFlashListProps,
  ScrollViewProps as SheetScrollViewProps,
  SectionListProps as SheetSectionListProps,
  TextInputProps as SheetTextInputProps,
}
