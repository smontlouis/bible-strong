import { useTheme } from '@emotion/react'
import { AnimatePresence } from '@alloc/moti'
import React, { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Pressable } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useQueryClient } from '@tanstack/react-query'
import { scheduleOnRN } from 'react-native-worklets'
import {
  cancelAnimation,
  Extrapolation,
  interpolate,
  interpolateColor,
  makeMutable,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
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
import { getGraphScenePositionIndexes } from './strongEntityGraphLayout'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

const GRAPH_HEIGHT = 410
const CENTER_Y = 188
const CENTER_NODE_SIZE = 82
const CENTER_LABEL_WIDTH = 120
const SATELLITE_NODE_SIZE = 58
const SATELLITE_WIDTH = 92

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

type GraphLayerMotion = {
  id: number
  kind: 'camera' | 'fade'
  progress: SharedValue<number>
  selectedUniqueName?: string
  selectedPositionIndex?: number
  departingUniqueName?: string
}

type GraphSceneLayerState = {
  id: number
  scene: GraphScene
  carry: GraphLayerMotion[]
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
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
  avatarRole?: 'center' | 'selected'
}) => {
  const theme = useTheme()
  const neutralBorderColor = theme.colors.border
  const selectedBorderColor = theme.colors.primary
  const avatarStyle = useAnimatedStyle(() => {
    const value = avatarProgress?.get() ?? 0
    const borderColor =
      avatarRole === 'selected'
        ? interpolateColor(value, [0, 1], [neutralBorderColor, selectedBorderColor])
        : avatarRole === 'center'
          ? interpolateColor(value, [0, 1], [selectedBorderColor, neutralBorderColor])
          : center
            ? selectedBorderColor
            : neutralBorderColor
    const borderWidth =
      avatarRole === 'selected'
        ? interpolate(value, [0, 1], [1, 2], Extrapolation.CLAMP)
        : avatarRole === 'center'
          ? interpolate(value, [0, 1], [2, 1], Extrapolation.CLAMP)
          : center
            ? 2
            : 1

    return {
      borderColor,
      borderWidth,
    }
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
      style={{ width: SATELLITE_NODE_SIZE, height: SATELLITE_NODE_SIZE, overflow: 'visible' }}
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
          <Text bold fontSize={12} textAlign="center" numberOfLines={2}>
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
            left={-8}
            top={19}
            width={20}
            height={20}
            borderRadius={20}
            center
            bg="lightGrey"
          >
            <FeatherIcon name="chevron-left" color="default" size={14} />
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
  children,
}: {
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  entryRole?: 'center' | 'previous' | 'relation'
  exitRole?: 'center' | 'selected' | 'relation'
  children: React.ReactNode
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const entryValue = entry?.progress.get() ?? 1
    const exitValue = exit?.progress.get() ?? 0
    const entryScale =
      entryRole === 'center'
        ? interpolate(entryValue, [0, 1], [0.71, 1], Extrapolation.CLAMP)
        : entryRole === 'previous'
          ? interpolate(entryValue, [0, 1], [1.42, 1], Extrapolation.CLAMP)
          : entryRole === 'relation'
            ? interpolate(entryValue, [0, 1], [0.3, 1], Extrapolation.CLAMP)
            : 1
    const exitScale =
      exitRole === 'center'
        ? interpolate(exitValue, [0, 1], [1, 0.71], Extrapolation.CLAMP)
        : exitRole === 'selected'
          ? interpolate(exitValue, [0, 1], [1, 1.42], Extrapolation.CLAMP)
          : exitRole === 'relation'
            ? interpolate(exitValue, [0, 1], [1, 0.3], Extrapolation.CLAMP)
            : 1

    return {
      transform: [{ scale: entryScale * exitScale }],
    }
  })

  return (
    <AnimatedBox overflow="visible" style={animatedStyle}>
      {children}
    </AnimatedBox>
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
    motion.progress.set(
      withSpring(1, { duration: 400 }, finished => {
        if (finished) scheduleOnRN(finish)
      })
    )

    return () => cancelAnimation(motion.progress)
  }, [motion])

  return null
}

const GraphSceneLayer = ({
  scene,
  width,
  carry,
  entry,
  exit,
  interactive,
  onOpenRelation,
  onGoBack,
}: {
  scene: GraphScene
  width: number
  carry: GraphLayerMotion[]
  entry?: GraphLayerMotion
  exit?: GraphLayerMotion
  interactive: boolean
  onOpenRelation: (relation: StrongLexiconEntityRelation, positionIndex: number) => void
  onGoBack: () => void
}) => {
  const { t } = useTranslation()
  const theme = useTheme()

  const center = { x: width / 2, y: CENTER_Y }
  const entryPosition =
    entry?.selectedPositionIndex == null
      ? center
      : graphPosition(entry.selectedPositionIndex, width)
  const exitPosition =
    exit?.selectedPositionIndex == null ? center : graphPosition(exit.selectedPositionIndex, width)
  const entryOffset = {
    x: center.x - entryPosition.x,
    y: center.y - entryPosition.y,
  }
  const exitOffset = {
    x: center.x - exitPosition.x,
    y: center.y - exitPosition.y,
  }
  const carryOffsets = carry.map(motion => {
    const position =
      motion.selectedPositionIndex == null
        ? center
        : graphPosition(motion.selectedPositionIndex, width)
    return {
      progress: motion.progress,
      x: center.x - position.x,
      y: center.y - position.y,
    }
  })
  const layerStyle = useAnimatedStyle(() => {
    const entryValue = entry?.progress.get() ?? 1
    const exitValue = exit?.progress.get() ?? 0
    const entryOpacity = entry ? entryValue : 1
    const exitOpacity = exit ? 1 - exitValue : 1
    let carriedTranslateX = 0
    let carriedTranslateY = 0
    for (const offset of carryOffsets) {
      const value = offset.progress.get()
      carriedTranslateX -= offset.x * (1 - value)
      carriedTranslateY -= offset.y * (1 - value)
    }

    return {
      opacity: entryOpacity * exitOpacity,
      transform: [
        {
          translateX:
            carriedTranslateX +
            (entry ? -entryOffset.x * (1 - entryValue) : 0) +
            (exit ? exitOffset.x * exitValue : 0),
        },
        {
          translateY:
            carriedTranslateY +
            (entry ? -entryOffset.y * (1 - entryValue) : 0) +
            (exit ? exitOffset.y * exitValue : 0),
        },
      ],
    }
  })

  const connections = (
    <Svg width={width} height={GRAPH_HEIGHT} style={{ position: 'absolute', inset: 0 }}>
      {scene.relationNodes.map(node => {
        const position = graphPosition(node.positionIndex, width)
        return (
          <Line
            key={`line:${node.key}`}
            x1={center.x}
            y1={center.y}
            x2={position.x}
            y2={position.y}
            stroke={theme.colors.border}
            strokeWidth={1.4}
          />
        )
      })}
      {scene.previousEntity && scene.previousPositionIndex != null && (
        <Line
          x1={center.x}
          y1={center.y}
          x2={graphPosition(scene.previousPositionIndex, width).x}
          y2={graphPosition(scene.previousPositionIndex, width).y}
          stroke={theme.colors.border}
          strokeWidth={1.4}
        />
      )}
    </Svg>
  )

  const nodes = (
    <>
      <Box
        position="absolute"
        left={center.x - CENTER_NODE_SIZE / 2}
        top={center.y - CENTER_NODE_SIZE / 2}
        size={CENTER_NODE_SIZE}
        overflow="visible"
      >
        <LayerNodeMotion
          entry={entry}
          exit={exit}
          entryRole={entry?.selectedUniqueName ? 'center' : undefined}
          exitRole={exit?.selectedUniqueName ? 'center' : undefined}
        >
          <Box size={CENTER_NODE_SIZE} position="relative" overflow="visible">
            <EntityGraphNode
              category={scene.navigation.activeEntity.category}
              type={scene.navigation.activeEntity.type}
              center
              avatarProgress={exit?.selectedUniqueName ? exit.progress : undefined}
              avatarRole={exit?.selectedUniqueName ? 'center' : undefined}
            />
            <Box
              position="absolute"
              top={CENTER_NODE_SIZE + 4}
              left={(CENTER_NODE_SIZE - CENTER_LABEL_WIDTH) / 2}
              width={CENTER_LABEL_WIDTH}
              alignItems="center"
              overflow="visible"
            >
              <Text bold fontSize={15} textAlign="center" numberOfLines={2}>
                {scene.navigation.activeEntity.name}
              </Text>
            </Box>
          </Box>
        </LayerNodeMotion>
      </Box>

      {scene.relationNodes.map(node => {
        const relation = node.relation
        const uniqueName = relation.targetUniqueName

        const position = graphPosition(node.positionIndex, width)
        const content = (
          <GraphSatelliteContent
            name={relation.targetName}
            category={relation.targetCategory}
            type={relation.targetType}
            label={t(characterRelationLabelKey(relation), {
              defaultValue: relation.relation,
            })}
            relation={relation.relation}
            back={false}
            avatarProgress={
              exit && uniqueName === exit.selectedUniqueName ? exit.progress : undefined
            }
            avatarRole={uniqueName === exit?.selectedUniqueName ? 'selected' : undefined}
            disabled={!uniqueName || !interactive}
            onPress={() => onOpenRelation(relation, node.positionIndex)}
          />
        )

        return (
          <Box
            key={node.key}
            position="absolute"
            left={position.x - SATELLITE_NODE_SIZE / 2}
            top={position.y - SATELLITE_NODE_SIZE / 2}
            size={SATELLITE_NODE_SIZE}
            overflow="visible"
          >
            <LayerNodeMotion
              entry={entry}
              exit={exit}
              entryRole={
                uniqueName === entry?.departingUniqueName
                  ? 'previous'
                  : entry
                    ? 'relation'
                    : undefined
              }
              exitRole={
                uniqueName === exit?.selectedUniqueName ? 'selected' : exit ? 'relation' : undefined
              }
            >
              {content}
            </LayerNodeMotion>
          </Box>
        )
      })}

      {scene.previousEntity && scene.previousPositionIndex != null && (
        <Box
          position="absolute"
          left={graphPosition(scene.previousPositionIndex, width).x - SATELLITE_NODE_SIZE / 2}
          top={graphPosition(scene.previousPositionIndex, width).y - SATELLITE_NODE_SIZE / 2}
          size={SATELLITE_NODE_SIZE}
          overflow="visible"
        >
          <LayerNodeMotion
            entry={entry}
            exit={exit}
            entryRole={
              scene.previousEntity.uniqueName === entry?.departingUniqueName
                ? 'previous'
                : undefined
            }
            exitRole={
              scene.previousEntity.uniqueName === exit?.selectedUniqueName ? 'selected' : undefined
            }
          >
            <GraphSatelliteContent
              name={scene.previousEntity.name}
              category={scene.previousEntity.category}
              type={scene.previousEntity.type}
              label={
                scene.previousRelation
                  ? t(characterRelationLabelKey(scene.previousRelation), {
                      defaultValue: scene.previousRelation.relation,
                    })
                  : ''
              }
              relation={scene.previousRelation?.relation ?? ''}
              back
              avatarProgress={
                exit && scene.previousEntity.uniqueName === exit.selectedUniqueName
                  ? exit.progress
                  : undefined
              }
              avatarRole={
                scene.previousEntity.uniqueName === exit?.selectedUniqueName
                  ? 'selected'
                  : undefined
              }
              disabled={!interactive}
              onPress={onGoBack}
            />
          </LayerNodeMotion>
        </Box>
      )}
    </>
  )

  return (
    <AnimatedBox
      position="absolute"
      inset={0}
      overflow="visible"
      pointerEvents={interactive ? 'auto' : 'none'}
      style={layerStyle}
    >
      {connections}
      {nodes}
    </AnimatedBox>
  )
}

export const StrongEntityRelationGraph = ({
  entity,
  onOpenEntity,
}: {
  entity: StrongLexiconEntity
  onOpenEntity: (relation: StrongLexiconEntityRelation) => void
}) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const queryClient = useQueryClient()
  const { language } = useStrongLexiconLanguage()
  const reduceMotion = useReducedMotion()
  const [width, setWidth] = useState(330)
  const rootNavigation: GraphNavigation = {
    activeEntity: entity,
    history: [],
    requestedPageIndex: 0,
  }
  const [navigation, setNavigation] = useState<GraphNavigation>(rootNavigation)
  const [sceneLayers, setSceneLayers] = useState<GraphSceneLayerState[]>([
    {
      id: 0,
      scene: buildGraphScene(rootNavigation),
      carry: [],
    },
  ])
  const [motions, setMotions] = useState<GraphLayerMotion[]>([])
  const nextLayerId = useRef(0)
  const nextMotionId = useRef(0)
  const latestRelationRequestId = useRef(0)

  useEffect(() => {
    const nextNavigation: GraphNavigation = {
      activeEntity: entity,
      history: [],
      requestedPageIndex: 0,
    }
    setNavigation(nextNavigation)
    setMotions([])
    setSceneLayers([
      {
        id: ++nextLayerId.current,
        scene: buildGraphScene(nextNavigation),
        carry: [],
      },
    ])
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
      current
        .filter(layer => layer.exit?.id !== motionId)
        .map(layer => ({
          ...layer,
          carry: layer.carry.filter(motion => motion.id !== motionId),
          entry: layer.entry?.id === motionId ? undefined : layer.entry,
        }))
    )
  }

  const beginTransition = ({
    to,
    kind,
    selectedUniqueName,
    selectedPositionIndex,
  }: {
    to: GraphNavigation
    kind: GraphLayerMotion['kind']
    selectedUniqueName?: string
    selectedPositionIndex?: number
  }) => {
    const targetScene = buildGraphScene(to)
    if (reduceMotion) {
      setNavigation(to)
      setMotions([])
      setSceneLayers([
        {
          id: ++nextLayerId.current,
          scene: targetScene,
          carry: [],
        },
      ])
      return
    }

    const motion: GraphLayerMotion = {
      id: ++nextMotionId.current,
      kind,
      progress: makeMutable(0),
      selectedUniqueName,
      selectedPositionIndex,
      departingUniqueName: activeScene.navigation.activeEntity.uniqueName,
    }
    const targetLayer: GraphSceneLayerState = {
      id: ++nextLayerId.current,
      scene: targetScene,
      carry: [],
      entry: motion,
    }

    setMotions(current => [...current, motion])
    setSceneLayers(current => {
      const sourceLayer = current.at(-1)
      if (!sourceLayer) return [targetLayer]
      const inheritedMotions = [
        ...sourceLayer.carry,
        ...(sourceLayer.entry ? [sourceLayer.entry] : []),
      ]

      return [
        ...current.slice(0, -1),
        {
          ...sourceLayer,
          exit: motion,
        },
        {
          ...targetLayer,
          carry: inheritedMotions,
        },
      ]
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
        history:
          target.uniqueName === entity.uniqueName
            ? []
            : [
                ...navigation.history,
                {
                  entity: navigation.activeEntity,
                  relation,
                  pageIndex: activeScene.page.pageIndex,
                  relationPositionIndex,
                },
              ],
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
    latestRelationRequestId.current += 1

    beginTransition({
      kind: 'fade',
      to: {
        activeEntity: entity,
        history: [],
        requestedPageIndex: 0,
      },
    })
  }

  const goToPage = (nextPageIndex: number) => {
    if (nextPageIndex === activeScene.page.pageIndex) return
    latestRelationRequestId.current += 1
    beginTransition({
      kind: 'fade',
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
    <VStack borderWidth={1} borderColor="border" borderRadius={24} bg="reverse" overflow="hidden">
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
        {sceneLayers.map((layer, index) => (
          <GraphSceneLayer
            key={layer.id}
            scene={layer.scene}
            width={width}
            carry={layer.carry}
            entry={layer.entry}
            exit={layer.exit}
            interactive={index === sceneLayers.length - 1}
            onOpenRelation={openRelation}
            onGoBack={goBack}
          />
        ))}
      </Box>

      <HStack
        height={44}
        center
        gap={18}
        position="relative"
        borderTopWidth={1}
        borderColor="border"
        accessibilityLabel={t('strongDetail.entity.graphPage', {
          current: activeScene.page.pageIndex + 1,
          count: activeScene.page.pageCount,
        })}
      >
        <AnimatePresence>
          {hasHistory && (
            <MotiBox
              key="graph-history-back"
              position="absolute"
              left={8}
              top={6}
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 180 }}
            >
              <Pressable
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel={t('strongDetail.entity.graphBack')}
              >
                <Box size={32} borderRadius={16} bg="lightGrey" center>
                  <FeatherIcon name="arrow-left" color="primary" size={16} />
                </Box>
              </Pressable>
            </MotiBox>
          )}

          {hasHistory && (
            <MotiBox
              key="graph-history-reset"
              position="absolute"
              right={8}
              top={6}
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 180 }}
            >
              <Pressable
                onPress={resetNavigation}
                accessibilityRole="button"
                accessibilityLabel={t('strongDetail.entity.graphReset')}
              >
                <Box size={32} borderRadius={16} bg="lightGrey" center>
                  <FeatherIcon name="rotate-ccw" color="primary" size={14} />
                </Box>
              </Pressable>
            </MotiBox>
          )}
        </AnimatePresence>

        <Pressable
          disabled={activeScene.page.pageIndex === 0}
          onPress={() => goToPage(activeScene.page.pageIndex - 1)}
          accessibilityRole="button"
          accessibilityLabel={t('strongDetail.entity.graphPreviousPage')}
          accessibilityState={{
            disabled: activeScene.page.pageIndex === 0,
          }}
        >
          <Box
            size={32}
            borderRadius={16}
            bg="lightGrey"
            center
            opacity={activeScene.page.pageIndex === 0 ? 0.4 : 1}
          >
            <FeatherIcon name="chevron-left" color="primary" size={18} />
          </Box>
        </Pressable>

        <Text bold color="tertiary" fontSize={12}>
          {activeScene.page.pageIndex + 1} / {activeScene.page.pageCount}
        </Text>

        <Pressable
          disabled={activeScene.page.pageIndex === activeScene.page.pageCount - 1}
          onPress={() => goToPage(activeScene.page.pageIndex + 1)}
          accessibilityRole="button"
          accessibilityLabel={t('strongDetail.entity.graphNextPage')}
          accessibilityState={{
            disabled: activeScene.page.pageIndex === activeScene.page.pageCount - 1,
          }}
        >
          <Box
            size={32}
            borderRadius={16}
            bg="lightGrey"
            center
            opacity={activeScene.page.pageIndex === activeScene.page.pageCount - 1 ? 0.4 : 1}
          >
            <FeatherIcon name="chevron-right" color="primary" size={18} />
          </Box>
        </Pressable>
      </HStack>
    </VStack>
  )
}
