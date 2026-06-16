import React, { forwardRef } from 'react'
import * as Sentry from '@sentry/react-native'
import {
  FlatList,
  Platform,
  ScrollView,
  SectionList,
  TextInput,
  useWindowDimensions,
  type FlatListProps,
  type ScrollViewProps,
  type SectionListProps,
  type TextInputProps,
  type View,
  type ViewProps,
} from 'react-native'
import { TrueSheet, TrueSheetProvider, type TrueSheetProps } from '@lodev09/react-native-true-sheet'
import { FlashList, type FlashListProps } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Back from '~common/Back'
import Box, { type BoxProps, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text, { type TextProps } from '~common/ui/Text'
import { useTheme } from '@emotion/react'

export type SheetSnapPoint = NonNullable<TrueSheetProps['detents']>[number]
export type SheetScrollableOptions = NonNullable<TrueSheetProps['scrollableOptions']>

type SheetContextValue = {
  footerHeight: number
  hasFooter: boolean
  setFooterHeight: React.Dispatch<React.SetStateAction<number>>
}

const SheetContext = React.createContext<SheetContextValue>({
  footerHeight: 0,
  hasFooter: false,
  setFooterHeight: () => {},
})

export type SheetRef = {
  present: () => void
  presentAt: (snapPoint: SheetSnapPoint) => void
  resizeTo: (snapPoint: SheetSnapPoint) => void
  dismiss: () => void
  close: () => void
  forceClose: () => void
}

export type SheetFooterProps = BoxProps & {
  onLayout?: ViewProps['onLayout']
  style?: ViewProps['style']
}

export type SheetViewProps = BoxProps & {
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

const withFooterMargin = (style: ViewProps['style'], footerHeight: number) => [
  style,
  footerHeight ? { marginBottom: footerHeight } : null,
]

const getFooterMarginStyle = (footerHeight: number) =>
  footerHeight ? { marginBottom: footerHeight } : undefined

type SheetCommand = 'present' | 'presentAt' | 'resizeTo' | 'dismiss' | 'close' | 'forceClose'

const isExpectedNativeSheetLifecycleError = (error: unknown) => {
  if (!(error instanceof Error)) return false

  return (
    /No sheet found with tag \d+/.test(error.message) ||
    /TrueSheetView with tag \d+ not found/.test(error.message) ||
    error.message === 'No presenting view controller found'
  )
}

const runSheetCommand = (command: SheetCommand, action: () => Promise<void> | undefined) => {
  try {
    const result = action()
    if (!result) return

    void result.catch(error => {
      if (isExpectedNativeSheetLifecycleError(error)) return

      Sentry.captureException(error, {
        tags: {
          component: 'Sheet',
          sheetCommand: command,
        },
      })
    })
  } catch (error) {
    if (isExpectedNativeSheetLifecycleError(error)) return

    Sentry.captureException(error, {
      tags: {
        component: 'Sheet',
        sheetCommand: command,
      },
    })
  }
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
  } = props
  const { height } = useWindowDimensions()
  const sheetRef = React.useRef<TrueSheet>(null)
  const detents = getDetents(snapPoints)
  const initialDetentIndex = initialSnapPoint ? findSnapPointIndex(detents, initialSnapPoint) : 0
  const scrollable = !detents.includes('auto')
  const theme = useTheme()
  const [footerHeight, setFooterHeight] = React.useState(0)
  const hasFooter = Boolean(footer)

  const renderedFooter = footer
    ? React.createElement(footer as React.ComponentType<SheetFooterProps>)
    : undefined

  React.useEffect(() => {
    if (!hasFooter) {
      setFooterHeight(0)
    }
  }, [hasFooter])

  React.useImperativeHandle(
    ref,
    () => ({
      present: () =>
        runSheetCommand('present', () => sheetRef.current?.present(initialDetentIndex)),
      presentAt: snapPoint =>
        runSheetCommand('presentAt', () =>
          sheetRef.current?.present(findSnapPointIndex(detents, snapPoint))
        ),
      resizeTo: snapPoint =>
        runSheetCommand('resizeTo', () =>
          sheetRef.current?.resize(findSnapPointIndex(detents, snapPoint))
        ),
      dismiss: () => runSheetCommand('dismiss', () => sheetRef.current?.dismiss()),
      close: () => runSheetCommand('close', () => sheetRef.current?.dismiss()),
      forceClose: () => runSheetCommand('forceClose', () => sheetRef.current?.dismiss()),
    }),
    [detents, initialDetentIndex]
  )

  return (
    <SheetContext.Provider value={{ footerHeight, hasFooter, setFooterHeight }}>
      <TrueSheet
        ref={sheetRef}
        detents={detents}
        dismissible={dismissible}
        dimmed={backdrop}
        draggable
        footer={renderedFooter}
        header={header}
        grabber
        {...(Platform.OS === 'android'
          ? {
              grabberOptions: {
                width: 38,
                height: 5,
                topMargin: 5,
              },
            }
          : undefined)}
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
    </SheetContext.Provider>
  )
})
Sheet.displayName = 'Sheet'

const SheetFooter = ({ children, onLayout, style, ...props }: SheetFooterProps) => {
  const insets = useSafeAreaInsets()
  const { hasFooter, setFooterHeight } = React.useContext(SheetContext)

  const handleLayout: NonNullable<ViewProps['onLayout']> = event => {
    if (hasFooter) {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height)
      setFooterHeight(currentHeight => (currentHeight === nextHeight ? currentHeight : nextHeight))
    }
    onLayout?.(event)
  }

  return (
    <Box px={20} pt={8} pb={8} mb={insets.bottom} onLayout={handleLayout} style={style} {...props}>
      {children}
    </Box>
  )
}

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

const SheetView = forwardRef<View, SheetViewProps>(({ style, ...props }, ref) => {
  const { footerHeight } = React.useContext(SheetContext)

  return <Box ref={ref} style={withFooterMargin(style, footerHeight)} {...props} />
})
SheetView.displayName = 'SheetView'

const SheetScrollView = forwardRef<ScrollView, ScrollViewProps>(
  ({ contentContainerStyle, ...props }, ref) => {
    const { footerHeight } = React.useContext(SheetContext)

    return (
      <ScrollView
        ref={ref}
        contentContainerStyle={withFooterMargin(contentContainerStyle, footerHeight)}
        {...props}
      />
    )
  }
)
SheetScrollView.displayName = 'SheetScrollView'

const SheetFlatList = <T,>({ contentContainerStyle, ...props }: FlatListProps<T>) => {
  const { footerHeight } = React.useContext(SheetContext)

  return (
    <FlatList
      contentContainerStyle={withFooterMargin(contentContainerStyle, footerHeight)}
      {...props}
    />
  )
}

const SheetSectionList = <ItemT, SectionT>({
  contentContainerStyle,
  ...props
}: SectionListProps<ItemT, SectionT>) => {
  const { footerHeight } = React.useContext(SheetContext)

  return (
    <SectionList
      contentContainerStyle={withFooterMargin(contentContainerStyle, footerHeight)}
      {...props}
    />
  )
}
const SheetTextInput = TextInput

const SheetFlashList = <T,>({
  estimatedItemSize: _estimatedItemSize,
  contentContainerStyle,
  ...props
}: FlashListProps<T> & { estimatedItemSize?: number }) => {
  const { footerHeight } = React.useContext(SheetContext)

  return <FlashList contentContainerStyle={getFooterMarginStyle(footerHeight)} {...props} />
}

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
