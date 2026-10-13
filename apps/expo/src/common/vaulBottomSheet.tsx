// Web bottom sheet built on vaul.
//
// This is the web implementation `@expo/ui/community/bottom-sheet` shipped until SDK 57, with the
// two changes the app used to patch into it: an accessible title and description, and a
// `backdropComponent={null}` mode that leaves the page behind the sheet interactive.
// SDK 58 replaced it with a modal HTML dialog, which covers the page and cannot stay non-modal.
import React, {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import {
  FlatList,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Drawer } from 'vaul'

export type BottomSheetMethods = {
  snapToIndex: (index: number) => void
  snapToPosition: (position: string | number) => void
  expand: () => void
  collapse: () => void
  close: () => void
  forceClose: () => void
  present: () => void
  dismiss: () => void
}

type BottomSheetProps = {
  accessibilityLabel?: string
  accessibilityDescription?: string
  ref?: Ref<BottomSheetMethods>
  snapPoints?: (string | number)[]
  index?: number
  enableDynamicSizing?: boolean
  enablePanDownToClose?: boolean
  // `null` hides the handle.
  handleComponent?: null
  // `null` removes the scrim and leaves the page behind the sheet interactive.
  backdropComponent?: null
  backgroundStyle?: StyleProp<ViewStyle>
  onChange?: (index: number) => void
  onClose?: () => void
  onDismiss?: () => void
  children?: ReactNode
}

// Lets BottomSheetView know that the sheet sizes itself to its content.
const BottomSheetInternalContext = React.createContext({ fitToContents: false })

const parseSnapPoint = (
  point: string | number
): { type: 'height'; value: number } | { type: 'fraction'; value: number } => {
  if (typeof point === 'number') return { type: 'height', value: point }
  if (point.endsWith('%')) return { type: 'fraction', value: parseFloat(point) / 100 }
  return { type: 'height', value: parseFloat(point) }
}

const resolveSnapPointPx = (point: string | number, containerHeight: number) => {
  const parsed = parseSnapPoint(point)
  return parsed.type === 'fraction' ? Math.round(containerHeight * parsed.value) : parsed.value
}

// Always true on web: BottomSheetView strips flex styles so vaul can measure content naturally.
const internalContextValue = { fitToContents: true }

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  zIndex: 999,
}

const defaultContentStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '0 16px',
  backgroundColor: '#fff',
  borderTopLeftRadius: 10,
  borderTopRightRadius: 10,
  zIndex: 1000,
}

const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
}

const BottomSheet = (props: BottomSheetProps) => {
  const {
    accessibilityDescription = 'Bottom sheet',
    accessibilityLabel = 'Bottom sheet',
    ref,
    snapPoints: snapPointsProp,
    index: indexProp = 0,
    onChange,
    onClose,
    onDismiss,
    enablePanDownToClose = false,
    handleComponent,
    backdropComponent,
    backgroundStyle,
    children,
  } = props
  const allowsBackgroundInteraction = backdropComponent === null

  const { height: windowHeight } = useWindowDimensions()

  const hasSnapPoints = snapPointsProp != null && snapPointsProp.length > 0
  const snapHeights = useMemo(() => {
    if (!hasSnapPoints) return []
    return snapPointsProp!.map(p => resolveSnapPointPx(p, windowHeight))
  }, [snapPointsProp, hasSnapPoints, windowHeight])

  const [isOpen, setIsOpen] = useState(indexProp >= 0)
  // Drives currentHeight for snap-point sheets. Vaul doesn't use snap points —
  // we control the content div height ourselves with CSS transition.
  const [snapIndex, setSnapIndex] = useState(() => {
    const maxIndex = hasSnapPoints ? snapHeights.length - 1 : 0
    return indexProp >= 0 ? Math.min(Math.max(indexProp, 0), maxIndex) : 0
  })

  // Stable callback refs
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  // Guards fireCloseCallbacks against double-firing.
  const closedRef = useRef(indexProp < 0)

  const fireCloseCallbacks = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onCloseRef.current?.()
    onDismissRef.current?.()
    onChangeRef.current?.(-1)
  }, [])

  useEffect(() => {
    if (indexProp === -1) {
      setIsOpen(false)
      fireCloseCallbacks()
      return
    }

    const maxIndex = hasSnapPoints ? snapHeights.length - 1 : 0
    setSnapIndex(Math.min(Math.max(indexProp, 0), maxIndex))
    closedRef.current = false
    setIsOpen(true)
  }, [hasSnapPoints, indexProp, snapHeights.length, fireCloseCallbacks])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (!open) fireCloseCallbacks()
    },
    [fireCloseCallbacks]
  )

  const methods: BottomSheetMethods = useMemo(() => {
    const snapToIndex = (index: number) => {
      if (index === -1) {
        setIsOpen(false)
        fireCloseCallbacks()
        return
      }
      const maxIndex = hasSnapPoints ? snapHeights.length - 1 : 0
      const clampedIndex = Math.min(Math.max(index, 0), maxIndex)
      closedRef.current = false
      setSnapIndex(clampedIndex)
      setIsOpen(true)
      onChangeRef.current?.(clampedIndex)
    }

    // Fire close callbacks immediately: vaul's `onOpenChange` is not guaranteed
    // to fire when `open` is driven externally, so we don't rely on handleOpenChange
    // here. The closedRef guard inside fireCloseCallbacks prevents double-firing
    // if a user-dismiss event also arrives during the animation.
    const close = () => {
      setIsOpen(false)
      fireCloseCallbacks()
    }

    return {
      snapToIndex,
      snapToPosition(position: string | number) {
        if (!hasSnapPoints) return
        const targetHeight = resolveSnapPointPx(position, windowHeight)
        let nearestIndex = 0
        let nearestDist = Infinity
        snapHeights.forEach((h, i) => {
          const dist = Math.abs(h - targetHeight)
          if (dist < nearestDist) {
            nearestDist = dist
            nearestIndex = i
          }
        })
        snapToIndex(nearestIndex)
      },
      expand: () => snapToIndex(hasSnapPoints ? snapHeights.length - 1 : 0),
      collapse: () => snapToIndex(0),
      close,
      forceClose: close,
      present: () => snapToIndex(0),
      dismiss: close,
    }
  }, [hasSnapPoints, snapHeights, windowHeight, fireCloseCallbacks])

  useImperativeHandle(ref, () => methods)

  const currentHeight = hasSnapPoints ? snapHeights[snapIndex] : undefined
  const innerStyle: React.CSSProperties | undefined =
    currentHeight != null
      ? { overflowY: 'auto', height: currentHeight, transition: 'height 0.3s ease' }
      : undefined

  const mergedContentStyle = useMemo<React.CSSProperties>(() => {
    const flat = StyleSheet.flatten(backgroundStyle)
    return flat ? { ...defaultContentStyle, ...(flat as React.CSSProperties) } : defaultContentStyle
  }, [backgroundStyle])

  return (
    <BottomSheetInternalContext.Provider value={internalContextValue}>
      <Drawer.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        modal={!allowsBackgroundInteraction}
        dismissible={enablePanDownToClose}
      >
        {!allowsBackgroundInteraction && <Drawer.Overlay style={overlayStyle} />}
        <Drawer.Portal>
          <Drawer.Content style={mergedContentStyle}>
            <Drawer.Title style={visuallyHiddenStyle}>{accessibilityLabel}</Drawer.Title>
            <Drawer.Description style={visuallyHiddenStyle}>
              {accessibilityDescription}
            </Drawer.Description>
            {handleComponent !== null && <Drawer.Handle />}
            <div style={innerStyle}>{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </BottomSheetInternalContext.Provider>
  )
}

// Always starts closed, whatever `index` says: it is opened with `present()`, at `index`.
export const BottomSheetModal = (props: BottomSheetProps) => {
  const { ref, index: presentIndex = 0, ...rest } = props
  const sheetRef = useRef<BottomSheetMethods>(null)

  useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (i: number) => sheetRef.current?.snapToIndex(i),
      snapToPosition: (p: string | number) => sheetRef.current?.snapToPosition(p),
      expand: () => sheetRef.current?.expand(),
      collapse: () => sheetRef.current?.collapse(),
      close: () => sheetRef.current?.close(),
      forceClose: () => sheetRef.current?.forceClose(),
      present: () => sheetRef.current?.snapToIndex(presentIndex),
      dismiss: () => sheetRef.current?.close(),
    }),
    [presentIndex]
  )

  return <BottomSheet ref={sheetRef} {...rest} index={-1} />
}

const stripFlexStyle = (style: StyleProp<ViewStyle>): StyleProp<ViewStyle> => {
  const flat = StyleSheet.flatten(style)
  if (!flat) return style
  const { flex: _, flexGrow: _g, flexShrink: _s, flexBasis: _b, ...rest } = flat
  return rest
}

// Without snap points the sheet takes the height of its content, so flex styles are stripped.
export const BottomSheetView = ({
  children,
  style,
}: {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}) => {
  const { fitToContents } = useContext(BottomSheetInternalContext)
  return <View style={fitToContents && style ? stripFlexStyle(style) : style}>{children}</View>
}

export const BottomSheetScrollView = ScrollView
export const BottomSheetFlatList = FlatList
export const BottomSheetSectionList = SectionList
export const BottomSheetTextInput = TextInput

export const BottomSheetModalProvider = ({ children }: { children: ReactNode }) => <>{children}</>
