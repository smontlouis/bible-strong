import { twMerge } from '~common/ui/classNames'

import type {
  CommentaryCatalogEntry,
  CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
import React from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler'
import {
  DropProvider,
  SortableDirection,
  SortableItem,
  useHorizontalSortableList,
  type SortableRenderItemProps,
} from 'react-native-reanimated-dnd'
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import CommentaryAvatar from './CommentaryAvatar'
import {
  orderCommentarySelectionByPositions,
  type CommentaryProjectionId,
} from './commentarySelection'
import { getAddedCommentaryProjectionIds } from './selectedCommentaryAnimations'
const SLOT_WIDTH = 56
const SLOT_GAP = 6
const SLOT_HEIGHT = 58
// Inside the scroll content, so avatars scroll to the screen edges.
const ROW_PADDING = 16

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

export type SelectedCommentaryHeaderItem = {
  projectionId: CommentaryProjectionId
  entry: CommentaryCatalogEntry
  language: CommentaryLanguage
}

type SortableCommentaryHeaderItem = SelectedCommentaryHeaderItem & {
  id: CommentaryProjectionId
}

type Props = {
  items: readonly SelectedCommentaryHeaderItem[]
  onRemove: (projectionId: CommentaryProjectionId) => void
  onMove: (fromIndex: number, toIndex: number) => void
  onReorder: (projectionIds: CommentaryProjectionId[]) => void
}

type SortableCommentaryRenderProps = SortableRenderItemProps<SortableCommentaryHeaderItem> & {
  containerWidth: number
}

type SortableCommentaryProps = SortableCommentaryRenderProps & {
  animateIn: boolean
  animateOut: boolean
  isDragging: boolean
  reduceMotion: boolean
  onRemove: Props['onRemove']
  onMove: Props['onMove']
  onReorder: Props['onReorder']
  onDragStateChange: (projectionId: CommentaryProjectionId, dragging: boolean) => void
}

const SortableCommentary = ({
  item,
  id,
  index,
  animateIn,
  animateOut,
  isDragging,
  reduceMotion,
  onRemove,
  onMove,
  onReorder,
  onDragStateChange,
  ...sortableProps
}: SortableCommentaryProps) => {
  const { t } = useTranslation()
  const dragProgress = useSharedValue(isDragging ? 1 : 0)
  const dragFeedbackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragProgress.get(), [0, 1], [1, 0.86]),
    transform: [{ scale: interpolate(dragProgress.get(), [0, 1], [1, 1.06]) }],
  }))

  React.useEffect(() => {
    dragProgress.set(withTiming(isDragging ? 1 : 0, { duration: 110 }))
  }, [dragProgress, isDragging])

  return (
    <SortableItem
      id={id}
      data={item}
      {...sortableProps}
      onDragStart={() => onDragStateChange(item.projectionId, true)}
      onDrop={(_droppedId, _toIndex, positions) => {
        onDragStateChange(item.projectionId, false)
        if (!positions) return
        onReorder(
          orderCommentarySelectionByPositions(
            Object.keys(positions) as CommentaryProjectionId[],
            positions
          )
        )
      }}
      style={{ height: SLOT_HEIGHT }}
    >
      <SortableItem.Handle>
        <Animated.View
          accessibilityRole="adjustable"
          accessibilityLabel={item.entry.title}
          accessibilityHint={t('commentaries.selector.reorderHint')}
          accessibilityActions={[
            { name: 'decrement', label: t('commentaries.selector.moveLeft') },
            { name: 'increment', label: t('commentaries.selector.moveRight') },
          ]}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'decrement' && index > 0) {
              onMove(index, index - 1)
            }
            if (
              event.nativeEvent.actionName === 'increment' &&
              index < sortableProps.itemsCount - 1
            ) {
              onMove(index, index + 1)
            }
          }}
          entering={!reduceMotion && animateIn ? FadeIn.duration(160) : undefined}
          exiting={!reduceMotion && animateOut ? FadeOut.duration(140) : undefined}
          style={[
            { width: SLOT_WIDTH, height: SLOT_HEIGHT, alignItems: 'center', paddingTop: 4 },
            dragFeedbackStyle,
          ]}
        >
          <Box className="border-continuous overflow-visible relative">
            <Box
              className={twMerge(
                'overflow-hidden border-continuous',
                twMerge(
                  isDragging ? 'border-primary' : 'border-[transparent]',
                  'overflow-hidden border-continuous absolute top-[-3px] left-[-3px] rounded-full border-[2px]'
                )
              )}
              pointerEvents="none"
              style={{ width: 44, height: 44 }}
            />
            <CommentaryAvatar
              resourceCode={`${item.entry.publicationId}:${item.language}`}
              author={item.entry.author}
              fallback={item.entry.shortName}
              size={38}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('commentaries.selector.removeSelection', {
                commentary: item.entry.title,
              })}
              hitSlop={8}
              onPress={() => onRemove(item.projectionId)}
              style={({ pressed }) => ({
                position: 'absolute',
                top: -5,
                right: -6,
                zIndex: 2,
                opacity: pressed ? 0.45 : 1,
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              <Box
                className="border-continuous overflow-hidden rounded-full items-center justify-center bg-opacity5"
                style={{ width: 18, height: 18 }}
              >
                <FeatherIcon name="x" size={12} color="tertiary" />
              </Box>
            </Pressable>
          </Box>
          <Text
            className="mt-[5px] text-[10px] text-center"
            numberOfLines={1}
            style={{ width: SLOT_WIDTH }}
          >
            {item.entry.shortName}
          </Text>
        </Animated.View>
      </SortableItem.Handle>
    </SortableItem>
  )
}

type SortableCommentaryRowProps = {
  items: SortableCommentaryHeaderItem[]
  viewportWidth: number
  savedScrollX: SharedValue<number>
  scrollToEnd: boolean
  renderItem: (props: SortableCommentaryRenderProps) => React.ReactNode
}

// The library's <Sortable> remounts on every order change and scrolls back to
// the start. Owning the scroll view keeps the position across reorders and
// reveals a newly added commentary.
const SortableCommentaryRow = ({
  items,
  viewportWidth,
  savedScrollX,
  scrollToEnd,
  renderItem,
}: SortableCommentaryRowProps) => {
  const {
    scrollViewRef,
    dropProviderRef,
    handleScroll,
    handleScrollEnd,
    scrollX,
    contentWidth,
    getItemProps,
  } = useHorizontalSortableList({
    data: items,
    itemWidth: SLOT_WIDTH,
    gap: SLOT_GAP,
    paddingHorizontal: ROW_PADDING,
  })
  const [initialScrollX] = React.useState(() => {
    const maxScrollX = Math.max(0, contentWidth - viewportWidth)
    return scrollToEnd ? maxScrollX : Math.min(savedScrollX.get(), maxScrollX)
  })

  React.useLayoutEffect(() => {
    scrollX.set(initialScrollX)
  }, [scrollX, initialScrollX])

  useAnimatedReaction(
    () => scrollX.get() as number,
    (current, previous) => {
      if (previous !== null) savedScrollX.set(current)
    }
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DropProvider ref={dropProviderRef}>
        <AnimatedScrollView
          ref={scrollViewRef}
          horizontal
          contentOffset={{ x: initialScrollX, y: 0 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollEndDrag={handleScrollEnd}
          onMomentumScrollEnd={handleScrollEnd}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1, height: SLOT_HEIGHT, backgroundColor: 'transparent' }}
          contentContainerStyle={{ width: contentWidth, height: SLOT_HEIGHT }}
        >
          {items.map((item, index) => {
            const itemProps = getItemProps(item, index)
            return renderItem({
              item,
              index,
              direction: SortableDirection.Horizontal,
              autoScrollHorizontalDirection: itemProps.autoScrollDirection,
              containerWidth: viewportWidth,
              ...itemProps,
            })
          })}
        </AnimatedScrollView>
      </DropProvider>
    </GestureHandlerRootView>
  )
}

const SelectedCommentariesHeader = ({ items, onRemove, onMove, onReorder }: Props) => {
  const reduceMotion = useReducedMotion()
  const previousProjectionIdsRef = React.useRef<readonly CommentaryProjectionId[] | undefined>(
    undefined
  )
  const [removingProjectionId, setRemovingProjectionId] = React.useState<CommentaryProjectionId>()
  const [draggingProjectionId, setDraggingProjectionId] = React.useState<CommentaryProjectionId>()
  const sortableItems: SortableCommentaryHeaderItem[] = React.useMemo(
    () =>
      items.map(item => ({
        ...item,
        id: item.projectionId,
      })),
    [items]
  )
  const projectionIds = React.useMemo(
    () => sortableItems.map(item => item.projectionId),
    [sortableItems]
  )
  const addedProjectionIds = React.useMemo(
    () => getAddedCommentaryProjectionIds(previousProjectionIdsRef.current, projectionIds),
    [projectionIds]
  )
  const { t } = useTranslation()
  const [rowWidth, setRowWidth] = React.useState(0)
  const savedScrollX = useSharedValue(0)

  React.useLayoutEffect(() => {
    previousProjectionIdsRef.current = projectionIds
  }, [projectionIds])

  const removeWithAnimation = React.useCallback(
    (projectionId: CommentaryProjectionId) => {
      if (removingProjectionId) return

      setRemovingProjectionId(projectionId)
      requestAnimationFrame(() => onRemove(projectionId))
      setTimeout(() => {
        setRemovingProjectionId(current => (current === projectionId ? undefined : current))
      }, 180)
    },
    [onRemove, removingProjectionId]
  )

  const handleDragStateChange = React.useCallback(
    (projectionId: CommentaryProjectionId, dragging: boolean) => {
      setDraggingProjectionId(dragging ? projectionId : undefined)
    },
    []
  )

  const renderItem = React.useCallback(
    (props: SortableCommentaryRenderProps) => (
      <SortableCommentary
        {...props}
        key={props.id}
        animateIn={addedProjectionIds.has(props.item.projectionId)}
        animateOut={removingProjectionId === props.item.projectionId}
        isDragging={draggingProjectionId === props.item.projectionId}
        reduceMotion={reduceMotion}
        onDragStateChange={handleDragStateChange}
        onRemove={removeWithAnimation}
        onMove={onMove}
        onReorder={onReorder}
      />
    ),
    [
      addedProjectionIds,
      draggingProjectionId,
      handleDragStateChange,
      onMove,
      onReorder,
      reduceMotion,
      removeWithAnimation,
      removingProjectionId,
    ]
  )

  return (
    <Box
      className="border-continuous overflow-hidden relative py-[10px] bg-reverse border-separator"
      style={{ minHeight: SLOT_HEIGHT + 20, borderBottomWidth: StyleSheet.hairlineWidth }}
      onLayout={event => setRowWidth(Math.floor(event.nativeEvent.layout.width))}
    >
      {sortableItems.length === 0 ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(160)}
          className="justify-center"
          style={{ height: SLOT_HEIGHT, paddingHorizontal: ROW_PADDING }}
        >
          <Text className="text-tertiary text-[13px]">
            {t('commentaries.selector.noneSelected')}
          </Text>
        </Animated.View>
      ) : rowWidth > 0 ? (
        <Box className="border-continuous overflow-visible" style={{ height: SLOT_HEIGHT }}>
          <SortableCommentaryRow
            key={`${projectionIds.join('|')}@${rowWidth}`}
            items={sortableItems}
            viewportWidth={rowWidth}
            savedScrollX={savedScrollX}
            scrollToEnd={addedProjectionIds.size > 0}
            renderItem={renderItem}
          />
        </Box>
      ) : null}
    </Box>
  )
}

export default SelectedCommentariesHeader
