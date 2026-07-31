import { useTheme } from '@emotion/react'
import { AnimatePresence } from '@alloc/moti'
import React, { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Pressable } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useQueryClient } from '@tanstack/react-query'
import { scheduleOnRN } from 'react-native-worklets'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  makeMutable,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, MotiBox, VStack } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type {
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
} from '~features/resources/strongLexiconAccess'
import {
  getStrongEntityPresentation,
  getStrongEntityRelationPage,
  splitStrongEntityRelations,
} from './strongEntityPresentation'
import { getStrongEntityAvatarSource } from './strongEntityAvatars'
import { getGraphScenePositionIndexes, GRAPH_POSITION_INDEXES } from './strongEntityGraphLayout'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

const GRAPH_HEIGHT = 410
const CENTER_Y = 188
const CENTER_NODE_SIZE = 82
const CENTER_LABEL_WIDTH = 120
const SATELLITE_NODE_SIZE = 58
const SATELLITE_WIDTH = 92
const CAMERA_RELATION_MIN_SCALE = 0.3
const PAGINATION_ENTRY_DELAY = 300
const PAGINATION_STAGGER_DELAY = 0
const PAGINATION_NODE_DURATION = 100
const PAGINATION_NODE_MIN_SCALE = 1
const PAGINATION_ENTRY_ROTATION_DEG = 10
const PAGINATION_EXIT_ROTATION_DEG = 30
const PAGINATION_TRANSLATE_FACTOR = 0
const DEFAULT_PAGINATION_STAGGER_INDEX = 0
const GRAPH_LAYER_POOL_SIZE = 3

const pressedOpacityStyle = ({ pressed }: { pressed: boolean }) => ({
  opacity: pressed ? 0.8 : 1,
})

type Point = {
  x: number
  y: number
}

type GraphHistoryEntry = {
  entity: StrongLexiconEntity
  relation: StrongLexiconEntityRelation
  pageIndex: number
  relationPositionIndex: number
}

type GraphNavigation = {
  activeEntity: StrongLexiconEntity
  history: GraphHistoryEntry[]
  requestedPageIndex: number
}

type GraphRelationNode = {
  key: string
  positionIndex: number
  relation: StrongLexiconEntityRelation
}

type GraphScene = {
  navigation: GraphNavigation
  page: ReturnType<typeof getStrongEntityRelationPage>
  previousEntry?: GraphHistoryEntry
  previousEntity?: StrongLexiconEntity
  previousRelation?: StrongLexiconEntityRelation
  previousPositionIndex?: number
  relationNodes: GraphRelationNode[]
}

type GraphMotionSpec =
  | { kind: 'camera'; paginationDirection?: never }
  | { kind: 'pagination'; paginationDirection: 1 | -1 }

type GraphLayerMotion = GraphMotionSpec & {
  id: number
  progress: SharedValue<number>
  paginationDuration?: number
  selectedUniqueName?: string
  selectedPositionIndex?: number
  departingUniqueName?: string
}

type GraphTransitionRequest = GraphMotionSpec & {
  to: GraphNavigation
  selectedUniqueName?: string
  selectedPositionIndex?: number
  sourceScene?: GraphScene
}

type GraphSceneLayerState = {
  id: number
  scene: GraphScene
  carry: GraphLayerMotion[]
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  visible: boolean
  current: boolean
  zIndex: number
}

type NodeEntryRole = 'center' | 'previous' | 'relation'
type NodeExitRole = 'center' | 'selected' | 'relation'
type AvatarRole = 'center' | 'selected'

const AnimatedLine = Animated.createAnimatedComponent(Line)

const getPaginationStaggerIndex = (
  positionIndex: number | undefined,
  direction: GraphLayerMotion['paginationDirection']
): number => {
  if (positionIndex == null) return 0
  let index = GRAPH_POSITION_INDEXES.findIndex(candidate => candidate === positionIndex)
  if (index < 0) index = DEFAULT_PAGINATION_STAGGER_INDEX
  if (direction === -1) return GRAPH_POSITION_INDEXES.length - 1 - index
  return index
}

const getStaggeredPaginationProgress = (
  value: number,
  isPagination: boolean,
  staggerIndex: number,
  fallback: number,
  paginationDuration: number,
  initialDelay = 0
): number => {
  'worklet'
  if (!isPagination) return fallback
  const delay = (initialDelay + staggerIndex * PAGINATION_STAGGER_DELAY) / paginationDuration
  const nodeDuration = PAGINATION_NODE_DURATION / paginationDuration
  return interpolate(value, [delay, delay + nodeDuration], [0, 1], Extrapolation.CLAMP)
}

const getLayerProgressValues = (
  entry: GraphLayerMotion | undefined,
  exit: GraphLayerMotion | undefined,
  entryStaggerIndex: number,
  exitStaggerIndex: number,
  isPositioned: boolean,
  preserveCameraProgress: boolean
): { entryValue: number; exitValue: number } => {
  'worklet'
  const rawEntryValue = entry?.progress.get() ?? 1
  const rawExitValue = exit?.progress.get() ?? 0
  let entryFallback = 1
  let exitFallback = 0

  if (preserveCameraProgress) {
    entryFallback = rawEntryValue
    exitFallback = rawExitValue
  }

  return {
    entryValue: getStaggeredPaginationProgress(
      rawEntryValue,
      entry?.kind === 'pagination' && isPositioned,
      entryStaggerIndex,
      entryFallback,
      entry?.paginationDuration ?? PAGINATION_NODE_DURATION,
      PAGINATION_ENTRY_DELAY
    ),
    exitValue: getStaggeredPaginationProgress(
      rawExitValue,
      exit?.kind === 'pagination' && isPositioned,
      exitStaggerIndex,
      exitFallback,
      exit?.paginationDuration ?? PAGINATION_NODE_DURATION
    ),
  }
}

const getEntryScale = (role: NodeEntryRole | undefined, progress: number): number => {
  'worklet'
  if (role === 'center') {
    return interpolate(progress, [0, 1], [0.71, 1], Extrapolation.CLAMP)
  }
  if (role === 'previous') {
    return interpolate(progress, [0, 1], [1.42, 1], Extrapolation.CLAMP)
  }
  if (role === 'relation') {
    return interpolate(progress, [0, 1], [CAMERA_RELATION_MIN_SCALE, 1], Extrapolation.CLAMP)
  }
  return 1
}

const getExitScale = (role: NodeExitRole | undefined, progress: number): number => {
  'worklet'
  if (role === 'center') {
    return interpolate(progress, [0, 1], [1, 0.71], Extrapolation.CLAMP)
  }
  if (role === 'selected') {
    return interpolate(progress, [0, 1], [1, 1.42], Extrapolation.CLAMP)
  }
  if (role === 'relation') {
    return interpolate(progress, [0, 1], [1, CAMERA_RELATION_MIN_SCALE], Extrapolation.CLAMP)
  }
  return 1
}

const rotateGraphRadius = (
  radiusX: number,
  radiusY: number,
  degrees: number,
  radiusScale: number
): Point => {
  'worklet'
  const radians = (degrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    x: (radiusX * cosine - radiusY * sine) * radiusScale,
    y: (radiusX * sine + radiusY * cosine) * radiusScale,
  }
}

const getRelationEntryRole = (
  uniqueName: string | undefined,
  motion: GraphLayerMotion | undefined
): NodeEntryRole | undefined => {
  if (!motion) return undefined
  return uniqueName === motion.departingUniqueName ? 'previous' : 'relation'
}

const getRelationExitRole = (
  uniqueName: string | undefined,
  motion: GraphLayerMotion | undefined
): NodeExitRole | undefined => {
  if (!motion) return undefined
  return uniqueName === motion.selectedUniqueName ? 'selected' : 'relation'
}

const getPreviousEntryRole = (
  uniqueName: string,
  motion: GraphLayerMotion | undefined
): NodeEntryRole | undefined =>
  uniqueName === motion?.departingUniqueName ? 'previous' : undefined

const getPreviousExitRole = (
  uniqueName: string,
  motion: GraphLayerMotion | undefined
): NodeExitRole | undefined => (uniqueName === motion?.selectedUniqueName ? 'selected' : undefined)

const isMotionSelection = (
  uniqueName: string | undefined,
  motion: GraphLayerMotion | undefined
): boolean => Boolean(uniqueName && uniqueName === motion?.selectedUniqueName)

const getCenterRole = (motion: GraphLayerMotion | undefined): 'center' | undefined => {
  if (motion?.selectedUniqueName) return 'center'
  return undefined
}

const relationLabelKey = (relation: string) => `strongDetail.entity.relation.${relation}`
const characterRelationLabelKey = (relation: StrongLexiconEntityRelation) => {
  const gender = relation.targetType?.toLowerCase()
  if (
    relation.targetCategory === 'person' &&
    (relation.relation === 'sibling' || relation.relation === 'partner') &&
    (gender === 'male' || gender === 'female')
  ) {
    return `${relationLabelKey(relation.relation)}.${gender}`
  }
  return relationLabelKey(relation.relation)
}

const getRelationVisual = (
  relation: string
): {
  icon: React.ComponentProps<typeof IonIcon>['name']
  color: string
} => {
  if (relation === 'father' || relation === 'mother') {
    return { icon: 'arrow-up', color: 'primary' }
  }
  if (relation === 'partner') {
    return { icon: 'heart', color: 'quart' }
  }
  if (relation === 'offspring') {
    return { icon: 'arrow-down', color: 'success' }
  }
  if (relation === 'sibling') {
    return { icon: 'people', color: 'secondary' }
  }
  return { icon: 'link', color: 'tertiary' }
}

const graphPosition = (index: number, width: number): Point => {
  const center = width / 2
  const positions = [
    { x: center, y: 52 },
    { x: 54, y: 284 },
    { x: width - 54, y: 284 },
    { x: 54, y: 92 },
    { x: width - 54, y: 92 },
    { x: center, y: 324 },
  ]
  return positions[index] ?? positions[5]
}

const getMotionPosition = (
  motion: GraphLayerMotion | undefined,
  center: Point,
  width: number
): Point => {
  if (motion?.selectedPositionIndex == null) return center
  return graphPosition(motion.selectedPositionIndex, width)
}

const getBackIndicatorPosition = (
  positionIndex: number
): {
  left?: number
  right?: number
  top: number
  transform: { rotate: string }[]
} => {
  const positions = [
    { left: 18, top: -8, transform: [{ rotate: '90deg' }] },
    { left: -4, top: 34, transform: [{ rotate: '-45deg' }] },
    { right: -4, top: 38, transform: [{ rotate: '-135deg' }] },
    { left: 0, top: 0, transform: [{ rotate: '45deg' }] },
    { right: 0, top: 0, transform: [{ rotate: '135deg' }] },
    { left: 20, top: 46, transform: [{ rotate: '-90deg' }] },
  ]
  return positions[positionIndex] ?? positions[0]
}

const buildGraphScene = (navigation: GraphNavigation): GraphScene => {
  const previousEntry = navigation.history.at(-1)
  const previousEntity = previousEntry?.entity
  const graphRelations = splitStrongEntityRelations(navigation.activeEntity).graph
  const previousRelation =
    graphRelations.find(relation => relation.targetUniqueName === previousEntity?.uniqueName) ??
    previousEntry?.relation
  const page = getStrongEntityRelationPage(
    graphRelations,
    previousEntity?.uniqueName,
    navigation.requestedPageIndex
  )
  const { previousPositionIndex, relationPositionIndexes } = getGraphScenePositionIndexes(
    previousEntry?.relationPositionIndex
  )

  return {
    navigation,
    page,
    previousEntry,
    previousEntity,
    previousRelation,
    previousPositionIndex,
    relationNodes: page.relations.map((relation, index) => ({
      key: `relation:${relation.relation}:${relation.targetUniqueName ?? relation.targetName}`,
      positionIndex: relationPositionIndexes[index],
      relation,
    })),
  }
}

const createRootNavigation = (entity: StrongLexiconEntity): GraphNavigation => ({
  activeEntity: entity,
  history: [],
  requestedPageIndex: 0,
})

const createGraphLayerPool = (scene: GraphScene): GraphSceneLayerState[] =>
  Array.from({ length: GRAPH_LAYER_POOL_SIZE }, (_, id) => ({
    id,
    scene,
    carry: [],
    visible: id === 0,
    current: id === 0,
    zIndex: id === 0 ? 0 : -1,
  }))

const getCurrentGraphLayer = (layers: GraphSceneLayerState[]): GraphSceneLayerState | undefined =>
  layers.find(layer => layer.current)

const getReusableGraphLayer = (
  layers: GraphSceneLayerState[]
): GraphSceneLayerState | undefined => {
  const hiddenLayer = layers.find(layer => !layer.visible)
  if (hiddenLayer) return hiddenLayer

  return layers
    .filter(layer => !layer.current)
    .reduce<GraphSceneLayerState | undefined>((oldest, layer) => {
      if (!oldest || layer.zIndex < oldest.zIndex) return layer
      return oldest
    }, undefined)
}

const getForwardHistory = ({
  rootEntity,
  navigation,
  target,
  relation,
  pageIndex,
  relationPositionIndex,
}: {
  rootEntity: StrongLexiconEntity
  navigation: GraphNavigation
  target: StrongLexiconEntity
  relation: StrongLexiconEntityRelation
  pageIndex: number
  relationPositionIndex: number
}): GraphHistoryEntry[] => {
  if (target.uniqueName === rootEntity.uniqueName) return []
  return [
    ...navigation.history,
    {
      entity: navigation.activeEntity,
      relation,
      pageIndex,
      relationPositionIndex,
    },
  ]
}

type GraphResetStep = {
  sourceScene: GraphScene
  previousEntry: GraphHistoryEntry
  to: GraphNavigation
}

const getResetSteps = (navigation: GraphNavigation): GraphResetStep[] => {
  const steps: GraphResetStep[] = []
  let sourceNavigation = navigation

  for (let index = navigation.history.length - 1; index >= 0; index -= 1) {
    const previousEntry = navigation.history[index]
    const to: GraphNavigation = {
      activeEntity: previousEntry.entity,
      history: navigation.history.slice(0, index),
      requestedPageIndex: previousEntry.pageIndex,
    }
    steps.push({ sourceScene: buildGraphScene(sourceNavigation), previousEntry, to })
    sourceNavigation = to
  }

  return steps
}

const createGraphLayerMotion = (
  request: GraphTransitionRequest,
  sourceScene: GraphScene,
  targetScene: GraphScene,
  id: number
): GraphLayerMotion => {
  const motionBase = {
    id,
    progress: makeMutable(0),
    selectedUniqueName: request.selectedUniqueName,
    selectedPositionIndex: request.selectedPositionIndex,
    departingUniqueName: sourceScene.navigation.activeEntity.uniqueName,
  }
  if (request.kind === 'pagination') {
    const animatedNodeCount = Math.max(
      sourceScene.relationNodes.length,
      targetScene.relationNodes.length
    )
    return {
      ...motionBase,
      kind: 'pagination',
      paginationDirection: request.paginationDirection,
      paginationDuration:
        PAGINATION_ENTRY_DELAY +
        Math.max(0, animatedNodeCount - 1) * PAGINATION_STAGGER_DELAY +
        PAGINATION_NODE_DURATION,
    }
  }
  return { ...motionBase, kind: 'camera' }
}

const getAvatarBorderStyle = (
  role: AvatarRole | undefined,
  center: boolean,
  progress: number,
  neutralColor: string,
  selectedColor: string
) => {
  'worklet'
  if (role === 'selected') {
    return {
      borderColor: interpolateColor(progress, [0, 1], [neutralColor, selectedColor]),
      borderWidth: interpolate(progress, [0, 1], [1, 2], Extrapolation.CLAMP),
    }
  }
  if (role === 'center') {
    return {
      borderColor: interpolateColor(progress, [0, 1], [selectedColor, neutralColor]),
      borderWidth: interpolate(progress, [0, 1], [2, 1], Extrapolation.CLAMP),
    }
  }
  return {
    borderColor: center ? selectedColor : neutralColor,
    borderWidth: center ? 2 : 1,
  }
}

const EntityGraphNode = ({
  category,
  type,
  center = false,
  avatarProgress,
  avatarRole,
}: {
  category?: string
  type?: string
  center?: boolean
  avatarProgress?: SharedValue<number>
  avatarRole?: AvatarRole
}) => {
  const theme = useTheme()
  const neutralBorderColor = theme.colors.border
  const selectedBorderColor = theme.colors.primary
  const avatarStyle = useAnimatedStyle(() => {
    const value = avatarProgress?.get() ?? 0
    return getAvatarBorderStyle(avatarRole, center, value, neutralBorderColor, selectedBorderColor)
  })

  return (
    <AnimatedBox
      size={center ? CENTER_NODE_SIZE : SATELLITE_NODE_SIZE}
      borderRadius={center ? CENTER_NODE_SIZE / 2 : SATELLITE_NODE_SIZE / 2}
      bg={center ? 'lightPrimary' : 'lightGrey'}
      borderWidth={center ? 2 : 1}
      borderColor={center ? 'primary' : 'border'}
      overflow="visible"
      center
      style={avatarStyle}
    >
      <Image
        source={getStrongEntityAvatarSource(category ?? 'other', type ?? 'Other')}
        style={{ width: center ? 76 : 54, height: center ? 76 : 54 }}
      />
    </AnimatedBox>
  )
}

const GraphSatelliteContent = ({
  name,
  category,
  type,
  label,
  relation,
  back,
  positionIndex,
  avatarProgress,
  avatarRole,
  disabled,
  onPress,
}: {
  name: string
  category?: string
  type?: string
  label: string
  relation: string
  back: boolean
  positionIndex?: number
  avatarProgress?: SharedValue<number>
  avatarRole?: 'selected'
  disabled: boolean
  onPress: () => void
}) => {
  const visual = getRelationVisual(relation)

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${name}`}
      style={({ pressed }) => ({
        width: SATELLITE_NODE_SIZE,
        height: SATELLITE_NODE_SIZE,
        overflow: 'visible',
        ...pressedOpacityStyle({ pressed }),
      })}
    >
      <Box size={SATELLITE_NODE_SIZE} position="relative" overflow="visible">
        <EntityGraphNode
          category={category}
          type={type}
          avatarProgress={avatarProgress}
          avatarRole={avatarRole}
        />
        <VStack
          position="absolute"
          top={SATELLITE_NODE_SIZE + 4}
          left={(SATELLITE_NODE_SIZE - SATELLITE_WIDTH) / 2}
          width={SATELLITE_WIDTH}
          alignItems="center"
          overflow="visible"
        >
          <Text bold fontSize={12} textAlign="center" numberOfLines={1}>
            {name}
          </Text>
          <HStack
            bg="lightGrey"
            borderRadius={12}
            px={7}
            py={3}
            mt={3}
            maxWidth={SATELLITE_WIDTH}
            alignItems="center"
            gap={3}
          >
            <IonIcon name={visual.icon} color={visual.color} size={10} />
            <Text
              color="default"
              fontSize={9}
              bold
              numberOfLines={1}
              textTransform="capitalize"
              opacity={0.5}
            >
              {label}
            </Text>
          </HStack>
        </VStack>
        {back && (
          <Box
            position="absolute"
            {...getBackIndicatorPosition(positionIndex ?? 0)}
            width={20}
            height={20}
            borderRadius={20}
            center
            bg="lightGrey"
          >
            <FeatherIcon name="chevron-left" color="primary" size={14} />
          </Box>
        )}
      </Box>
    </Pressable>
  )
}

const LayerNodeMotion = ({
  entry,
  exit,
  entryRole,
  exitRole,
  positionIndex,
  offsetToCenter,
  children,
}: {
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  entryRole?: NodeEntryRole
  exitRole?: NodeExitRole
  positionIndex?: number
  offsetToCenter?: Point
  children: React.ReactNode
}) => {
  const entryStaggerIndex = getPaginationStaggerIndex(positionIndex, entry?.paginationDirection)
  const exitStaggerIndex = getPaginationStaggerIndex(positionIndex, exit?.paginationDirection)
  const animatedStyle = useAnimatedStyle(() => {
    const { entryValue, exitValue } = getLayerProgressValues(
      entry,
      exit,
      entryStaggerIndex,
      exitStaggerIndex,
      positionIndex != null,
      true
    )
    const entryIsPaginationRelation = entry?.kind === 'pagination' && positionIndex != null
    const exitIsPaginationRelation = exit?.kind === 'pagination' && positionIndex != null
    const entryScale = getEntryScale(entryIsPaginationRelation ? undefined : entryRole, entryValue)
    const exitScale = getExitScale(exitIsPaginationRelation ? undefined : exitRole, exitValue)
    const paginationEntryScale = entryIsPaginationRelation
      ? interpolate(entryValue, [0, 1], [PAGINATION_NODE_MIN_SCALE, 1], Extrapolation.CLAMP)
      : 1
    const paginationExitScale = exitIsPaginationRelation
      ? interpolate(exitValue, [0, 1], [1, PAGINATION_NODE_MIN_SCALE], Extrapolation.CLAMP)
      : 1
    const radiusX = -(offsetToCenter?.x ?? 0)
    const radiusY = -(offsetToCenter?.y ?? 0)
    let radiusScale = 1
    let rotationDegrees = 0
    let opacity = 1

    if (entryIsPaginationRelation) {
      radiusScale *= 1 - PAGINATION_TRANSLATE_FACTOR * (1 - entryValue)
      rotationDegrees +=
        (entry?.paginationDirection ?? 1) * PAGINATION_ENTRY_ROTATION_DEG * (1 - entryValue)
      opacity *= entryValue
    }
    if (exitIsPaginationRelation) {
      radiusScale *= 1 - PAGINATION_TRANSLATE_FACTOR * exitValue
      rotationDegrees -= (exit?.paginationDirection ?? 1) * PAGINATION_EXIT_ROTATION_DEG * exitValue
      opacity *= 1 - exitValue
    }
    const rotatedRadius = rotateGraphRadius(radiusX, radiusY, rotationDegrees, radiusScale)
    const translateX = rotatedRadius.x - radiusX
    const translateY = rotatedRadius.y - radiusY

    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { scale: entryScale * exitScale * paginationEntryScale * paginationExitScale },
      ],
    }
  })

  return (
    <AnimatedBox overflow="visible" style={animatedStyle}>
      {children}
    </AnimatedBox>
  )
}

const GraphRelationConnection = ({
  center,
  position,
  positionIndex,
  color,
  entry,
  exit,
}: {
  center: Point
  position: Point
  positionIndex: number
  color: string
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
}) => {
  const entryStaggerIndex = getPaginationStaggerIndex(positionIndex, entry?.paginationDirection)
  const exitStaggerIndex = getPaginationStaggerIndex(positionIndex, exit?.paginationDirection)
  const animatedProps = useAnimatedProps(() => {
    const { entryValue, exitValue } = getLayerProgressValues(
      entry,
      exit,
      entryStaggerIndex,
      exitStaggerIndex,
      true,
      false
    )
    const entryIsPagination = entry?.kind === 'pagination'
    const exitIsPagination = exit?.kind === 'pagination'
    let radiusScale = 1
    let rotationDegrees = 0

    if (entryIsPagination) {
      radiusScale *= 1 - PAGINATION_TRANSLATE_FACTOR * (1 - entryValue)
      rotationDegrees +=
        (entry?.paginationDirection ?? 1) * PAGINATION_ENTRY_ROTATION_DEG * (1 - entryValue)
    }
    if (exitIsPagination) {
      radiusScale *= 1 - PAGINATION_TRANSLATE_FACTOR * exitValue
      rotationDegrees -= (exit?.paginationDirection ?? 1) * PAGINATION_EXIT_ROTATION_DEG * exitValue
    }

    const rotatedRadius = rotateGraphRadius(
      position.x - center.x,
      position.y - center.y,
      rotationDegrees,
      radiusScale
    )

    return {
      x2: center.x + rotatedRadius.x,
      y2: center.y + rotatedRadius.y,
      opacity: entryValue * (1 - exitValue),
    }
  })

  return (
    <AnimatedLine
      animatedProps={animatedProps}
      x1={center.x}
      y1={center.y}
      stroke={color}
      strokeWidth={1.4}
    />
  )
}

const GraphPreviousConnection = ({
  center,
  position,
  neutralColor,
  selectedColor,
  entry,
}: {
  center: Point
  position: Point
  neutralColor: string
  selectedColor: string
  entry?: GraphLayerMotion
}) => {
  const animatedProps = useAnimatedProps(() => {
    const progress = entry?.kind === 'camera' ? entry.progress.get() : 1
    return {
      stroke: interpolateColor(progress, [0, 1], [neutralColor, selectedColor]),
      strokeWidth: progress === 1 ? 1.8 : 1.4,
    }
  })

  return (
    <AnimatedLine
      animatedProps={animatedProps}
      x1={center.x}
      y1={center.y}
      x2={position.x}
      y2={position.y}
    />
  )
}

const GraphMotionDriver = ({
  motion,
  onFinished,
}: {
  motion: GraphLayerMotion
  onFinished: (motionId: number) => void
}) => {
  const finish = useEffectEvent(() => onFinished(motion.id))

  useEffect(() => {
    motion.progress.set(0)
    if (motion.kind === 'pagination') {
      motion.progress.set(
        withTiming(
          1,
          {
            duration: motion.paginationDuration ?? PAGINATION_NODE_DURATION,
            easing: Easing.linear,
          },
          finished => {
            if (finished) scheduleOnRN(finish)
          }
        )
      )
    } else {
      motion.progress.set(
        withSpring(1, { duration: 400 }, finished => {
          if (finished) scheduleOnRN(finish)
        })
      )
    }

    return () => cancelAnimation(motion.progress)
  }, [motion])

  return null
}

const GraphPageButton = ({
  icon,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  disabled: boolean
  accessibilityLabel: string
  onPress: () => void
}) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled }}
    style={pressedOpacityStyle}
  >
    <Box size={32} borderRadius={16} bg="lightGrey" center opacity={disabled ? 0.4 : 1}>
      <FeatherIcon name={icon} color="primary" size={18} />
    </Box>
  </Pressable>
)

const GraphHistoryButton = ({
  icon,
  side,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  side: 'left' | 'right'
  accessibilityLabel: string
  onPress: () => void
}) => (
  <MotiBox
    position="absolute"
    {...{ [side]: 8 }}
    top={6}
    from={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ type: 'timing', duration: 180 }}
  >
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={pressedOpacityStyle}
    >
      <Box size={32} borderRadius={16} bg="lightGrey" center>
        <FeatherIcon name={icon} color="primary" size={icon === 'arrow-left' ? 16 : 14} />
      </Box>
    </Pressable>
  </MotiBox>
)

const GraphFooter = ({
  pageIndex,
  pageCount,
  hasHistory,
  onGoBack,
  onReset,
  onGoToPage,
}: {
  pageIndex: number
  pageCount: number
  hasHistory: boolean
  onGoBack: () => void
  onReset: () => void
  onGoToPage: (pageIndex: number) => void
}) => {
  const { t } = useTranslation()

  return (
    <HStack
      center
      py={6}
      gap={12}
      position="relative"
      borderTopWidth={1}
      borderColor="border"
      accessibilityLabel={t('strongDetail.entity.graphPage', {
        current: pageIndex + 1,
        count: pageCount,
      })}
    >
      <AnimatePresence>
        {hasHistory && (
          <GraphHistoryButton
            key="graph-history-back"
            icon="arrow-left"
            side="left"
            accessibilityLabel={t('strongDetail.entity.graphBack')}
            onPress={onGoBack}
          />
        )}
        {hasHistory && (
          <GraphHistoryButton
            key="graph-history-reset"
            icon="rotate-ccw"
            side="right"
            accessibilityLabel={t('strongDetail.entity.graphReset')}
            onPress={onReset}
          />
        )}
      </AnimatePresence>

      <GraphPageButton
        icon="chevron-left"
        disabled={pageIndex === 0}
        onPress={() => onGoToPage(pageIndex - 1)}
        accessibilityLabel={t('strongDetail.entity.graphPreviousPage')}
      />

      <Text bold color="tertiary" fontSize={12}>
        {pageIndex + 1} / {pageCount}
      </Text>

      <GraphPageButton
        icon="chevron-right"
        disabled={pageIndex === pageCount - 1}
        onPress={() => onGoToPage(pageIndex + 1)}
        accessibilityLabel={t('strongDetail.entity.graphNextPage')}
      />
    </HStack>
  )
}

const GraphCenterNode = ({
  entity,
  center,
  entry,
  exit,
  canOpenProfile,
  showsProfileAction,
  onOpenProfile,
}: {
  entity: StrongLexiconEntity
  center: Point
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  canOpenProfile: boolean
  showsProfileAction: boolean
  onOpenProfile: (entityKey: string) => void
}) => {
  const { t } = useTranslation()
  const openProfile = () => onOpenProfile(entity.uniqueName)
  const entryRole = getCenterRole(entry)
  const exitRole = getCenterRole(exit)

  return (
    <Box
      position="absolute"
      left={center.x - CENTER_NODE_SIZE / 2}
      top={center.y - CENTER_NODE_SIZE / 2}
      size={CENTER_NODE_SIZE}
      overflow="visible"
    >
      <LayerNodeMotion entry={entry} exit={exit} entryRole={entryRole} exitRole={exitRole}>
        <Box size={CENTER_NODE_SIZE} position="relative" overflow="visible">
          <Pressable
            disabled={!canOpenProfile}
            onPress={openProfile}
            accessibilityRole="button"
            accessibilityLabel={t('strongDetail.entity.viewProfile')}
            style={({ pressed }) => ({
              width: CENTER_NODE_SIZE,
              height: CENTER_NODE_SIZE,
              ...pressedOpacityStyle({ pressed }),
            })}
          >
            <EntityGraphNode
              category={entity.category}
              type={entity.type}
              center
              avatarProgress={exitRole ? exit?.progress : undefined}
              avatarRole={exitRole}
            />
          </Pressable>
          <VStack
            position="absolute"
            top={CENTER_NODE_SIZE + 4}
            left={(CENTER_NODE_SIZE - CENTER_LABEL_WIDTH) / 2}
            width={CENTER_LABEL_WIDTH}
            alignItems="center"
            overflow="visible"
          >
            <Text bold fontSize={15} textAlign="center" numberOfLines={1}>
              {entity.name}
            </Text>
            {showsProfileAction && (
              <Pressable
                disabled={!canOpenProfile}
                onPress={openProfile}
                accessibilityRole="button"
                accessibilityLabel={t('strongDetail.entity.viewProfile')}
                style={pressedOpacityStyle}
              >
                <HStack
                  bg="lightGrey"
                  borderRadius={12}
                  px={7}
                  py={3}
                  mt={3}
                  alignItems="center"
                  gap={2}
                >
                  <Text color="tertiary" fontSize={9} bold>
                    {t('strongDetail.entity.viewProfile')}
                  </Text>
                  <IonIcon name="chevron-forward" color="tertiary" size={10} />
                </HStack>
              </Pressable>
            )}
          </VStack>
        </Box>
      </LayerNodeMotion>
    </Box>
  )
}

const GraphRelationNodeView = ({
  node,
  center,
  width,
  entry,
  exit,
  interactive,
  onOpenRelation,
}: {
  node: GraphRelationNode
  center: Point
  width: number
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  interactive: boolean
  onOpenRelation: (relation: StrongLexiconEntityRelation, positionIndex: number) => void
}) => {
  const { t } = useTranslation()
  const { relation, positionIndex } = node
  const uniqueName = relation.targetUniqueName
  const position = graphPosition(positionIndex, width)
  const isSelected = isMotionSelection(uniqueName, exit)

  return (
    <Box
      position="absolute"
      left={position.x - SATELLITE_NODE_SIZE / 2}
      top={position.y - SATELLITE_NODE_SIZE / 2}
      size={SATELLITE_NODE_SIZE}
      overflow="visible"
    >
      <LayerNodeMotion
        entry={entry}
        exit={exit}
        positionIndex={positionIndex}
        offsetToCenter={{ x: center.x - position.x, y: center.y - position.y }}
        entryRole={getRelationEntryRole(uniqueName, entry)}
        exitRole={getRelationExitRole(uniqueName, exit)}
      >
        <GraphSatelliteContent
          name={relation.targetName}
          category={relation.targetCategory}
          type={relation.targetType}
          label={t(characterRelationLabelKey(relation), {
            defaultValue: relation.relation,
          })}
          relation={relation.relation}
          back={false}
          avatarProgress={isSelected ? exit?.progress : undefined}
          avatarRole={isSelected ? 'selected' : undefined}
          disabled={!uniqueName || !interactive}
          onPress={() => onOpenRelation(relation, positionIndex)}
        />
      </LayerNodeMotion>
    </Box>
  )
}

const GraphPreviousNode = ({
  entity,
  relation,
  positionIndex,
  width,
  entry,
  exit,
  interactive,
  onGoBack,
}: {
  entity: StrongLexiconEntity
  relation?: StrongLexiconEntityRelation
  positionIndex: number
  width: number
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  interactive: boolean
  onGoBack: () => void
}) => {
  const { t } = useTranslation()
  const position = graphPosition(positionIndex, width)
  const isSelected = isMotionSelection(entity.uniqueName, exit)
  const label = relation
    ? t(characterRelationLabelKey(relation), { defaultValue: relation.relation })
    : ''

  return (
    <Box
      position="absolute"
      left={position.x - SATELLITE_NODE_SIZE / 2}
      top={position.y - SATELLITE_NODE_SIZE / 2}
      size={SATELLITE_NODE_SIZE}
      overflow="visible"
    >
      <LayerNodeMotion
        entry={entry}
        exit={exit}
        entryRole={getPreviousEntryRole(entity.uniqueName, entry)}
        exitRole={getPreviousExitRole(entity.uniqueName, exit)}
      >
        <GraphSatelliteContent
          name={entity.name}
          category={entity.category}
          type={entity.type}
          label={label}
          relation={relation?.relation ?? ''}
          back
          positionIndex={positionIndex}
          avatarProgress={isSelected ? exit?.progress : undefined}
          avatarRole={isSelected ? 'selected' : undefined}
          disabled={!interactive}
          onPress={onGoBack}
        />
      </LayerNodeMotion>
    </Box>
  )
}

const GraphSceneLayer = ({
  scene,
  width,
  carry,
  entry,
  exit,
  visible,
  zIndex,
  interactive,
  currentProfileEntityKey,
  onOpenProfile,
  onOpenRelation,
  onGoBack,
}: {
  scene: GraphScene
  width: number
  carry: GraphLayerMotion[]
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  visible: boolean
  zIndex: number
  interactive: boolean
  currentProfileEntityKey?: string
  onOpenProfile: (entityKey: string) => void
  onOpenRelation: (relation: StrongLexiconEntityRelation, positionIndex: number) => void
  onGoBack: () => void
}) => {
  const theme = useTheme()
  const [preparedEntryId, setPreparedEntryId] = useState(entry?.id)
  const entryIsPrepared = !entry || preparedEntryId === entry.id
  const layerIsVisible = visible && entryIsPrepared
  const showsProfileAction = scene.navigation.activeEntity.uniqueName !== currentProfileEntityKey
  const canOpenProfile = interactive && showsProfileAction
  const rendersPersistentNodes = exit?.kind !== 'pagination'

  useLayoutEffect(() => {
    if (!visible || !entry || entryIsPrepared) return

    const frame = requestAnimationFrame(() => setPreparedEntryId(entry.id))
    return () => cancelAnimationFrame(frame)
  }, [entry, entryIsPrepared, visible])

  const center = { x: width / 2, y: CENTER_Y }
  const entryPosition = getMotionPosition(entry, center, width)
  const exitPosition = getMotionPosition(exit, center, width)
  const entryOffset = {
    x: center.x - entryPosition.x,
    y: center.y - entryPosition.y,
  }
  const exitOffset = {
    x: center.x - exitPosition.x,
    y: center.y - exitPosition.y,
  }
  const carryOffsets = carry.map(motion => {
    const position = getMotionPosition(motion, center, width)
    return {
      kind: motion.kind,
      progress: motion.progress,
      x: center.x - position.x,
      y: center.y - position.y,
    }
  })
  const layerStyle = useAnimatedStyle(() => {
    const entryValue = entry?.progress.get() ?? 1
    const exitValue = exit?.progress.get() ?? 0
    let entryOpacity = 1
    let exitOpacity = 1
    let entryTranslateX = 0
    let entryTranslateY = 0
    let exitTranslateX = 0
    let exitTranslateY = 0
    let carriedTranslateX = 0
    let carriedTranslateY = 0

    if (entry?.kind === 'camera') {
      entryOpacity = entryValue
      entryTranslateX = -entryOffset.x * (1 - entryValue)
      entryTranslateY = -entryOffset.y * (1 - entryValue)
    }
    if (exit?.kind === 'camera') {
      exitOpacity = 1 - exitValue
      exitTranslateX = exitOffset.x * exitValue
      exitTranslateY = exitOffset.y * exitValue
    }
    for (const offset of carryOffsets) {
      const value = offset.progress.get()
      if (offset.kind === 'camera') {
        carriedTranslateX -= offset.x * (1 - value)
        carriedTranslateY -= offset.y * (1 - value)
      }
    }

    return {
      opacity: entryOpacity * exitOpacity,
      transform: [
        {
          translateX: carriedTranslateX + entryTranslateX + exitTranslateX,
        },
        {
          translateY: carriedTranslateY + entryTranslateY + exitTranslateY,
        },
      ],
    }
  })

  const connections = (
    <Svg width={width} height={GRAPH_HEIGHT} style={{ position: 'absolute', inset: 0 }}>
      {scene.relationNodes.map(node => {
        const position = graphPosition(node.positionIndex, width)
        return (
          <GraphRelationConnection
            key={`line-position:${node.positionIndex}`}
            center={center}
            position={position}
            positionIndex={node.positionIndex}
            color={theme.colors.border}
            entry={entry}
            exit={exit}
          />
        )
      })}
      {rendersPersistentNodes && scene.previousEntity && scene.previousPositionIndex != null && (
        <GraphPreviousConnection
          center={center}
          position={graphPosition(scene.previousPositionIndex, width)}
          neutralColor={theme.colors.border}
          selectedColor={theme.colors.primary}
          entry={entry}
        />
      )}
    </Svg>
  )

  const nodes = (
    <>
      {rendersPersistentNodes && (
        <GraphCenterNode
          entity={scene.navigation.activeEntity}
          center={center}
          entry={entry}
          exit={exit}
          canOpenProfile={canOpenProfile}
          showsProfileAction={showsProfileAction}
          onOpenProfile={onOpenProfile}
        />
      )}

      {scene.relationNodes.map(node => (
        <GraphRelationNodeView
          key={`relation-position:${node.positionIndex}`}
          node={node}
          center={center}
          width={width}
          entry={entry}
          exit={exit}
          interactive={interactive}
          onOpenRelation={onOpenRelation}
        />
      ))}

      {rendersPersistentNodes && scene.previousEntity && scene.previousPositionIndex != null && (
        <GraphPreviousNode
          entity={scene.previousEntity}
          relation={scene.previousRelation}
          positionIndex={scene.previousPositionIndex}
          width={width}
          entry={entry}
          exit={exit}
          interactive={interactive}
          onGoBack={onGoBack}
        />
      )}
    </>
  )

  return (
    <AnimatedBox
      position="absolute"
      inset={0}
      overflow="visible"
      pointerEvents={interactive && layerIsVisible ? 'auto' : 'none'}
      accessibilityElementsHidden={!layerIsVisible}
      importantForAccessibility={layerIsVisible ? 'auto' : 'no-hide-descendants'}
      style={[{ display: layerIsVisible ? 'flex' : 'none', zIndex }, layerStyle]}
    >
      {connections}
      {nodes}
    </AnimatedBox>
  )
}

export const StrongEntityRelationGraph = ({
  entity,
  currentProfileEntityKey,
  onOpenProfile,
  onOpenEntity,
}: {
  entity: StrongLexiconEntity
  currentProfileEntityKey?: string
  onOpenProfile: (entityKey: string) => void
  onOpenEntity: (relation: StrongLexiconEntityRelation) => void
}) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const queryClient = useQueryClient()
  const { language } = useStrongLexiconLanguage()
  const reduceMotion = useReducedMotion()
  const [width, setWidth] = useState(330)
  const rootNavigation = createRootNavigation(entity)
  const [navigation, setNavigation] = useState<GraphNavigation>(rootNavigation)
  const [sceneLayers, setSceneLayers] = useState<GraphSceneLayerState[]>(() =>
    createGraphLayerPool(buildGraphScene(rootNavigation))
  )
  const [motions, setMotions] = useState<GraphLayerMotion[]>([])
  const nextLayerZIndex = useRef(0)
  const nextMotionId = useRef(0)
  const latestRelationRequestId = useRef(0)

  useEffect(() => {
    const nextNavigation = createRootNavigation(entity)
    nextLayerZIndex.current = 0
    setNavigation(nextNavigation)
    setMotions([])
    setSceneLayers(createGraphLayerPool(buildGraphScene(nextNavigation)))
  }, [entity])

  const activeScene = buildGraphScene(navigation)
  const visibleTargetNames = activeScene.page.relations
    .map(relation => relation.targetUniqueName)
    .filter((uniqueName): uniqueName is string => Boolean(uniqueName))
  const visibleTargetsKey = JSON.stringify(visibleTargetNames)

  useEffect(() => {
    const targets = JSON.parse(visibleTargetsKey) as string[]
    targets.forEach(uniqueName => {
      void queryClient.prefetchQuery({
        queryKey: ['strong-lexicon', 'entity', language, uniqueName],
        queryFn: () => resources.strongLexicon.loadEntity(uniqueName, language),
        networkMode: 'always',
        staleTime: Infinity,
      })
    })
  }, [language, queryClient, resources, visibleTargetsKey])

  const finishMotion = (motionId: number) => {
    setMotions(current => current.filter(motion => motion.id !== motionId))
    setSceneLayers(current =>
      current.map(layer => {
        if (layer.exit?.id === motionId) {
          return {
            ...layer,
            carry: [],
            entry: undefined,
            exit: undefined,
            visible: false,
            current: false,
            zIndex: -1,
          }
        }

        return {
          ...layer,
          carry: layer.carry.filter(motion => motion.id !== motionId),
          entry: layer.entry?.id === motionId ? undefined : layer.entry,
        }
      })
    )
  }

  const beginTransition = (request: GraphTransitionRequest) => {
    const { to, sourceScene = activeScene } = request
    const targetScene = buildGraphScene(to)
    if (reduceMotion) {
      nextLayerZIndex.current = 0
      setNavigation(to)
      setMotions([])
      setSceneLayers(createGraphLayerPool(targetScene))
      return
    }

    const motion = createGraphLayerMotion(request, sourceScene, targetScene, ++nextMotionId.current)

    setMotions(current => [...current, motion])
    setSceneLayers(current => {
      const sourceLayer = getCurrentGraphLayer(current)
      const targetLayer = getReusableGraphLayer(current)
      if (!sourceLayer || !targetLayer) return createGraphLayerPool(targetScene)
      const inheritedMotions = [
        ...sourceLayer.carry,
        ...(sourceLayer.entry ? [sourceLayer.entry] : []),
      ]
      const targetZIndex = ++nextLayerZIndex.current

      return current.map(layer => {
        if (layer.id === sourceLayer.id) {
          return {
            ...layer,
            current: false,
            exit: motion,
          }
        }
        if (layer.id === targetLayer.id) {
          return {
            ...layer,
            scene: targetScene,
            carry: inheritedMotions,
            entry: motion,
            exit: undefined,
            visible: true,
            current: true,
            zIndex: targetZIndex,
          }
        }
        return layer
      })
    })
    setNavigation(to)
  }

  const startRelationTransition = (
    relation: StrongLexiconEntityRelation,
    target: StrongLexiconEntity,
    relationPositionIndex: number
  ) => {
    if (!getStrongEntityPresentation(target).showsRelationshipGraph) {
      onOpenEntity(relation)
      return
    }

    beginTransition({
      kind: 'camera',
      selectedUniqueName: target.uniqueName,
      selectedPositionIndex: relationPositionIndex,
      to: {
        activeEntity: target,
        history: getForwardHistory({
          rootEntity: entity,
          navigation,
          target,
          relation,
          pageIndex: activeScene.page.pageIndex,
          relationPositionIndex,
        }),
        requestedPageIndex: 0,
      },
    })
  }

  const openRelation = async (
    relation: StrongLexiconEntityRelation,
    relationPositionIndex: number
  ) => {
    if (!relation.targetUniqueName) return
    const requestId = ++latestRelationRequestId.current
    const queryKey = ['strong-lexicon', 'entity', language, relation.targetUniqueName] as const
    const cachedTarget = queryClient.getQueryData<StrongLexiconEntity>(queryKey)

    if (cachedTarget) {
      if (requestId !== latestRelationRequestId.current) return
      startRelationTransition(relation, cachedTarget, relationPositionIndex)
      return
    }

    try {
      const target = await queryClient.ensureQueryData({
        queryKey,
        queryFn: () => resources.strongLexicon.loadEntity(relation.targetUniqueName!, language),
        networkMode: 'always',
        staleTime: Infinity,
      })
      if (requestId !== latestRelationRequestId.current) return
      if (target) startRelationTransition(relation, target, relationPositionIndex)
    } catch {
      if (requestId !== latestRelationRequestId.current) return
      onOpenEntity(relation)
    }
  }

  const goBack = () => {
    const previousEntry = activeScene.previousEntry
    if (!previousEntry) return
    latestRelationRequestId.current += 1

    beginTransition({
      kind: 'camera',
      selectedUniqueName: previousEntry.entity.uniqueName,
      selectedPositionIndex: activeScene.previousPositionIndex,
      to: {
        activeEntity: previousEntry.entity,
        history: navigation.history.slice(0, -1),
        requestedPageIndex: previousEntry.pageIndex,
      },
    })
  }

  const resetNavigation = () => {
    if (!navigation.history.length) return
    const sequenceId = ++latestRelationRequestId.current
    getResetSteps(navigation).forEach(({ sourceScene, previousEntry, to }, index) => {
      setTimeout(() => {
        if (latestRelationRequestId.current !== sequenceId) return
        beginTransition({
          kind: 'camera',
          sourceScene,
          selectedUniqueName: previousEntry.entity.uniqueName,
          selectedPositionIndex: sourceScene.previousPositionIndex,
          to,
        })
      }, index * 350)
    })
  }

  const goToPage = (nextPageIndex: number) => {
    if (nextPageIndex === activeScene.page.pageIndex) return
    latestRelationRequestId.current += 1
    beginTransition({
      kind: 'pagination',
      paginationDirection: nextPageIndex > activeScene.page.pageIndex ? 1 : -1,
      to: {
        ...navigation,
        requestedPageIndex: nextPageIndex,
      },
    })
  }

  const graphRelations = splitStrongEntityRelations(navigation.activeEntity).graph
  const hasHistory = navigation.history.length > 0
  if (!graphRelations.length && !activeScene.previousEntity) return null

  return (
    <VStack borderWidth={1} borderColor="border" borderRadius={20} bg="reverse" overflow="hidden">
      <Box
        height={GRAPH_HEIGHT}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel={t('strongDetail.entity.graphCurrent', {
          name: navigation.activeEntity.name,
        })}
      >
        {motions.map(motion => (
          <GraphMotionDriver key={motion.id} motion={motion} onFinished={finishMotion} />
        ))}
        {sceneLayers.map(layer => (
          <GraphSceneLayer
            key={layer.id}
            scene={layer.scene}
            width={width}
            carry={layer.carry}
            entry={layer.entry}
            exit={layer.exit}
            visible={layer.visible}
            zIndex={layer.zIndex}
            interactive={layer.current}
            currentProfileEntityKey={currentProfileEntityKey}
            onOpenProfile={onOpenProfile}
            onOpenRelation={openRelation}
            onGoBack={goBack}
          />
        ))}
      </Box>

      <GraphFooter
        pageIndex={activeScene.page.pageIndex}
        pageCount={activeScene.page.pageCount}
        hasHistory={hasHistory}
        onGoBack={goBack}
        onReset={resetNavigation}
        onGoToPage={goToPage}
      />
    </VStack>
  )
}
