import { Global, useTheme } from '@emotion/react'
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetSectionList,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetMethods,
} from '@expo/ui/community/bottom-sheet'
import { FlashList, type FlashListProps } from '@shopify/flash-list'
import React, { forwardRef } from 'react'
import {
  ScrollView,
  TextInput,
  type FlatListProps,
  type ScrollViewProps,
  type SectionListProps,
  type TextInputProps,
  type View,
  type ViewProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Back from '~common/Back'
import Box, { FadingText, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type {
  SheetFooterProps,
  SheetHeaderProps,
  SheetItemProps,
  SheetProps,
  SheetRef,
  SheetSnapPoint,
  SheetViewProps,
} from '~common/sheet'

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

const toExpoSnapPoint = (snapPoint: SheetSnapPoint): string | number | null => {
  if (snapPoint === 'auto') return null
  if (typeof snapPoint === 'number' && snapPoint > 0 && snapPoint <= 1) {
    return `${Math.round(snapPoint * 100)}%`
  }
  return snapPoint
}

const getSnapPoints = (snapPoints?: SheetSnapPoint[]) => {
  const mapped = snapPoints
    ?.map(toExpoSnapPoint)
    .filter((point): point is string | number => Boolean(point))
  return mapped?.length ? mapped : undefined
}

const findSnapPointIndex = (
  snapPoints: SheetSnapPoint[] | undefined,
  snapPoint: SheetSnapPoint
) => {
  if (!snapPoints?.length) return 0
  if (snapPoint === 'auto') return 0

  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  snapPoints.forEach((point, index) => {
    if (point === 'auto') return
    const distance = Math.abs(Number(point) - Number(snapPoint))
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

const getHeaderAccessibilityTitle = (header: SheetProps['header']) => {
  if (!React.isValidElement<{ title?: unknown }>(header)) return undefined
  return typeof header.props.title === 'string' ? header.props.title : undefined
}

const Sheet = forwardRef<SheetRef, SheetProps>((props, ref) => {
  const {
    accessibilityDescription,
    accessibilityLabel,
    backdrop = true,
    backgroundColor,
    children,
    cornerRadius = 18,
    dismissible = true,
    draggable = true,
    footer,
    header,
    initialSnapPoint,
    maxWidth = 720,
    onClose,
    onDismiss,
    onDismissStart,
    onOpenChange,
    onPresent,
    snapPoints,
  } = props
  const theme = useTheme()
  const sheetRef = React.useRef<BottomSheetMethods>(null)
  const isOpenRef = React.useRef(false)
  const dismissStartedRef = React.useRef(false)
  const [footerHeight, setFooterHeight] = React.useState(0)
  const hasFooter = Boolean(footer)
  const effectiveFooterHeight = hasFooter ? footerHeight : 0
  const expoSnapPoints = getSnapPoints(snapPoints)
  const initialIndex = initialSnapPoint ? findSnapPointIndex(snapPoints, initialSnapPoint) : 0
  const dialogTitle = accessibilityLabel || getHeaderAccessibilityTitle(header) || 'Bottom sheet'
  const dialogDescription = accessibilityDescription || dialogTitle

  const renderedFooter = footer
    ? React.createElement(footer as React.ComponentType<SheetFooterProps>)
    : undefined
  const renderedHeader = header
    ? React.isValidElement(header)
      ? header
      : React.createElement(header as React.ComponentType<unknown>)
    : undefined

  React.useImperativeHandle(ref, () => {
    const notifyPresent = () => {
      if (isOpenRef.current) return
      isOpenRef.current = true
      dismissStartedRef.current = false
      onOpenChange?.(true)
      onPresent?.()
    }
    const dismiss = (force = false) => {
      if (!isOpenRef.current) return
      if (!dismissStartedRef.current) {
        dismissStartedRef.current = true
        onDismissStart?.()
      }
      if (force) sheetRef.current?.forceClose()
      else sheetRef.current?.dismiss()
    }

    return {
      present: () => {
        notifyPresent()
        sheetRef.current?.present()
      },
      presentAt: snapPoint => {
        notifyPresent()
        sheetRef.current?.snapToIndex(findSnapPointIndex(snapPoints, snapPoint))
      },
      resizeTo: snapPoint =>
        sheetRef.current?.snapToIndex(findSnapPointIndex(snapPoints, snapPoint)),
      dismiss: () => dismiss(),
      close: () => dismiss(),
      forceClose: () => dismiss(true),
    }
  }, [onDismissStart, onOpenChange, onPresent, snapPoints])

  const handleClose = () => {
    if (!isOpenRef.current) return
    if (!dismissStartedRef.current) onDismissStart?.()
    dismissStartedRef.current = false
    isOpenRef.current = false
    onOpenChange?.(false)
    onClose?.()
    onDismiss?.()
  }

  return (
    <SheetContext.Provider
      value={{ footerHeight: effectiveFooterHeight, hasFooter, setFooterHeight }}
    >
      <BottomSheetModal
        accessibilityLabel={dialogTitle}
        accessibilityDescription={dialogDescription}
        ref={sheetRef}
        index={initialIndex}
        snapPoints={expoSnapPoints}
        enableDynamicSizing={!expoSnapPoints}
        enablePanDownToClose={dismissible}
        handleComponent={draggable ? undefined : null}
        backdropComponent={backdrop ? undefined : null}
        backgroundStyle={{
          backgroundColor: backgroundColor || theme.colors.reverse,
          borderTopLeftRadius: cornerRadius,
          borderTopRightRadius: cornerRadius,
          maxWidth,
          marginLeft: 'auto',
          marginRight: 'auto',
          ...(backdrop ? undefined : { boxShadow: 'none' }),
        }}
        onClose={handleClose}
      >
        {!backdrop && (
          <>
            <Global
              styles={`body:has([data-testid="expo-sheet-interactive-background"]) {
                pointer-events: auto !important;
              }`}
            />
            <Box
              testID="expo-sheet-interactive-background"
              position="absolute"
              width={0}
              height={0}
            />
          </>
        )}
        {renderedHeader}
        {children}
        {renderedFooter}
      </BottomSheetModal>
    </SheetContext.Provider>
  )
})
Sheet.displayName = 'ExpoUiSheet'

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
            <FadingText
              accessibilityRole="header"
              numberOfLines={1}
              bold
              fontSize={16}
              textAlign={centerTitle ? 'center' : 'left'}
            >
              {title}
            </FadingText>
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

const SheetItem = ({ children, tag, onPress, ...props }: SheetItemProps) => (
  <TouchableBox
    accessibilityRole="button"
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
      <Text color="grey" fontSize={12}>
        {tag}
      </Text>
    )}
  </TouchableBox>
)

const SheetView = forwardRef<View, SheetViewProps>(({ style, ...props }, ref) => {
  const { footerHeight } = React.useContext(SheetContext)

  return (
    <BottomSheetView style={withFooterMargin(style, footerHeight)}>
      <Box ref={ref} {...props} />
    </BottomSheetView>
  )
})
SheetView.displayName = 'ExpoUiSheetView'

const SheetScrollView = forwardRef<ScrollView, ScrollViewProps>(
  ({ contentContainerStyle, ...props }, ref) => {
    const { footerHeight } = React.useContext(SheetContext)

    return (
      <BottomSheetScrollView
        ref={ref}
        contentContainerStyle={withFooterMargin(contentContainerStyle, footerHeight)}
        {...props}
      />
    )
  }
)
SheetScrollView.displayName = 'ExpoUiSheetScrollView'

const SheetFlatList = <T,>({ contentContainerStyle, ...props }: FlatListProps<T>) => {
  const { footerHeight } = React.useContext(SheetContext)

  return (
    <BottomSheetFlatList
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
    <BottomSheetSectionList
      contentContainerStyle={withFooterMargin(contentContainerStyle, footerHeight)}
      {...props}
    />
  )
}

const SheetTextInput = BottomSheetTextInput || TextInput

const SheetFlashList = <T,>({
  estimatedItemSize: _estimatedItemSize,
  contentContainerStyle: _contentContainerStyle,
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
  BottomSheetModalProvider as SheetProvider,
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
  SheetFooterProps,
  SheetHeaderProps,
  SheetItemProps,
  SheetProps,
  SheetRef,
  SheetScrollableOptions,
  SheetSnapPoint,
  SheetViewProps,
} from '~common/sheet'

export type {
  FlatListProps as SheetFlatListProps,
  FlashListProps as SheetFlashListProps,
  ScrollViewProps as SheetScrollViewProps,
  SectionListProps as SheetSectionListProps,
  TextInputProps as SheetTextInputProps,
}
