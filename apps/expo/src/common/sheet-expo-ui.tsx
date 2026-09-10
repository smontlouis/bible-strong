import { twMerge } from '~common/ui/classNames'
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
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import PageContent from '~common/ui/PageContent'
import { useTheme } from '~themes/ThemeProvider'
import { webThemeVariables } from '~themes/webThemeVariables'

import Back from '~common/Back'
import type {
  SheetFooterProps,
  SheetHeaderProps,
  SheetItemProps,
  SheetProps,
  SheetRef,
  SheetSnapPoint,
  SheetViewProps,
} from '~common/sheet'
import Box, { FadingText, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

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

const useSheetFooterInset = () => {
  const { footerHeight } = React.useContext(SheetContext)
  const insets = useSafeAreaInsets()
  return footerHeight + insets.bottom
}

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
    maxWidth = 550,
    onClose,
    onDismiss,
    onDismissStart,
    onOpenChange,
    onPresent,
    snapPoints,
    webContainerBounds,
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
        backgroundStyle={
          {
            ...webThemeVariables(theme.colors),
            backgroundColor: backgroundColor || theme.colors.reverse,
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
            maxWidth,
            boxSizing: 'border-box',
            paddingLeft: 0,
            paddingRight: 0,
            marginLeft: 'auto',
            marginRight: 'auto',
            boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.10), 0 -1px 4px rgba(0, 0, 0, 0.04)',
            ...(webContainerBounds
              ? {
                  '--bible-selection-left': `${webContainerBounds.left}px`,
                  right: webContainerBounds.right,
                  bottom: webContainerBounds.bottom,
                  maxWidth: Math.min(maxWidth, webContainerBounds.width),
                  maxHeight: webContainerBounds.height,
                  overflow: 'auto' as const,
                  visibility:
                    webContainerBounds.width > 0 && webContainerBounds.height > 0
                      ? ('visible' as const)
                      : ('hidden' as const),
                }
              : {}),
          } as ViewStyle
        }
        onClose={handleClose}
      >
        {!backdrop && (
          <>
            <style>{`body:has([data-testid="expo-sheet-interactive-background"]) {
              pointer-events: auto !important;
            }`}</style>
            <Box
              className="overflow-hidden border-continuous absolute w-[0px] h-[0px]"
              testID="expo-sheet-interactive-background"
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
    <Box
      onLayout={handleLayout}
      style={[{ marginBottom: insets.bottom }, style]}
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge('overflow-hidden border-continuous pt-[8px] pb-[8px] px-[20px]', props.className)
      )}
    >
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
  <Box className="border-continuous overflow-hidden border-border border-b-[1px]">
    <PageContent>
      {(title || subTitle || hasBackButton || leftComponent || rightComponent) && (
        <Box className="overflow-hidden border-continuous min-h-[54px] flex-row items-center">
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
            className="overflow-hidden border-continuous flex-[1] justify-center"
            style={{
              paddingLeft: hasBackButton || leftComponent ? 0 : 20,
              paddingRight: rightComponent ? 0 : 20,
              alignItems: centerTitle ? 'center' : undefined,
            }}
          >
            {!!title && (
              <FadingText
                className="overflow-hidden border-continuous font-bold text-[16px]"
                accessibilityRole="header"
                numberOfLines={1}
                style={{ textAlign: centerTitle ? 'center' : 'left' }}
              >
                {title}
              </FadingText>
            )}
            {!!subTitle && (
              <Text
                className="text-[13px] text-grey"
                style={{ textAlign: centerTitle ? 'center' : 'left' }}
              >
                {subTitle}
              </Text>
            )}
          </Box>
          {rightComponent}
        </Box>
      )}
      {children}
    </PageContent>
  </Box>
)

const SheetItem = ({ children, tag, onPress, ...props }: SheetItemProps) => (
  <TouchableBox
    className="border-continuous overflow-visible flex-row items-center justify-between p-[20px] border-border border-b-[1px]"
    accessibilityRole="button"
    onPress={onPress}
  >
    <Text {...props}>{children}</Text>
    {Boolean(tag) && <Text className="text-grey text-[12px]">{tag}</Text>}
  </TouchableBox>
)

const SheetView = forwardRef<View, SheetViewProps>(({ style, ...props }, ref) => {
  const { footerHeight } = React.useContext(SheetContext)

  return (
    <BottomSheetView style={withFooterMargin(style, footerHeight)}>
      <Box
        ref={ref}
        {...props}
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge('overflow-hidden border-continuous', props.className)
        )}
      />
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
  SheetFlashList,
  SheetFlatList,
  SheetFooter,
  SheetHeader,
  SheetItem,
  BottomSheetModalProvider as SheetProvider,
  SheetScrollView,
  SheetSectionList,
  SheetTextInput,
  SheetView,
  useSheetFooterInset,
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
  FlashListProps as SheetFlashListProps,
  FlatListProps as SheetFlatListProps,
  ScrollViewProps as SheetScrollViewProps,
  SectionListProps as SheetSectionListProps,
  TextInputProps as SheetTextInputProps,
}
