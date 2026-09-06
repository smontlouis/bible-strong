import { twMerge } from '~common/ui/classNames'

import type {
  CommentaryCatalogEntry,
  CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
import React from 'react'
import { Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Sortable,
  SortableDirection,
  SortableItem,
  type SortableRenderItemProps,
} from 'react-native-reanimated-dnd'
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
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
  max: number
  onRemove: (projectionId: CommentaryProjectionId) => void
  onMove: (fromIndex: number, toIndex: number) => void
  onReorder: (projectionIds: CommentaryProjectionId[]) => void
}

type SortableCommentaryProps = SortableRenderItemProps<SortableCommentaryHeaderItem> & {
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
      animatedStyle={{ shadowOpacity: 0, shadowRadius: 0, elevation: 0 }}
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
                  'overflow-hidden border-continuous absolute top-[-3px] left-[-3px] rounded-[22px] border-[2px]'
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
                className="border-continuous overflow-hidden rounded-[10px] items-center justify-center bg-reverse border-[1px] border-border"
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

const SelectedCommentariesHeader = ({ items, max, onRemove, onMove, onReorder }: Props) => {
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
  const emptySlots = Array.from({ length: Math.max(0, max - items.length) })
  const selectedWidth =
    sortableItems.length * SLOT_WIDTH + Math.max(0, sortableItems.length - 1) * SLOT_GAP

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
    (props: SortableRenderItemProps<SortableCommentaryHeaderItem>) => (
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
    <Box className="border-continuous overflow-hidden relative py-[10px] px-[16px] bg-reverse border-b-[1px] border-border">
      <Box
        className="overflow-hidden border-continuous flex-row items-start"
        style={{ minHeight: SLOT_HEIGHT, gap: SLOT_GAP }}
      >
        {sortableItems.length > 0 ? (
          <Box
            className="border-continuous overflow-visible"
            style={{ width: selectedWidth, height: SLOT_HEIGHT }}
          >
            <Sortable
              data={sortableItems}
              renderItem={renderItem}
              direction={SortableDirection.Horizontal}
              itemWidth={SLOT_WIDTH}
              gap={SLOT_GAP}
              useFlatList={false}
              style={{ height: SLOT_HEIGHT, backgroundColor: 'transparent' }}
              contentContainerStyle={{ height: SLOT_HEIGHT }}
            />
          </Box>
        ) : null}
        {emptySlots.map((_, index) => (
          <Animated.View
            key={`empty-${items.length + index}`}
            entering={reduceMotion ? undefined : FadeIn.duration(160)}
            exiting={reduceMotion ? undefined : FadeOut.duration(140)}
            layout={reduceMotion ? undefined : LinearTransition.duration(160)}
            style={{ width: SLOT_WIDTH, alignItems: 'center', paddingTop: 4 }}
          >
            <Box className="overflow-hidden border-continuous opacity-[0.5]">
              <Box
                className="border-continuous overflow-hidden rounded-[19px] items-center justify-center border-[1px] border-dashed border-tertiary"
                style={{ width: 38, height: 38 }}
              >
                <FeatherIcon name="plus" size={18} color="tertiary" />
              </Box>
            </Box>
          </Animated.View>
        ))}
      </Box>
      <Text className="absolute right-[16px] bottom-[8px] text-tertiary text-[12px]">
        {items.length}/{max}
      </Text>
    </Box>
  )
}

export default SelectedCommentariesHeader
