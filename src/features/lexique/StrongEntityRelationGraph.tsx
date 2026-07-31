import { useTheme } from '@emotion/react'
import React, { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Pressable } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useQueryClient } from '@tanstack/react-query'
import {
  cancelAnimation,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
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

const GRAPH_HEIGHT = 340
const CENTER_Y = 164
const SATELLITE_WIDTH = 92
const SATELLITE_TOP_OFFSET = 40

type Point = {
  x: number
  y: number
}

type GraphHistoryEntry = {
  entity: StrongLexiconEntity
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
  previousPositionIndex?: number
  relationNodes: GraphRelationNode[]
}

type GraphTransition = {
  id: number
  kind: 'camera' | 'fade'
  from: GraphScene
  to: GraphScene
  selectedUniqueName?: string
  selectedPositionIndex?: number
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

const graphPosition = (index: number, width: number): Point => {
  const center = width / 2
  const positions = [
    { x: center, y: 54 },
    { x: 54, y: 246 },
    { x: width - 54, y: 246 },
    { x: 54, y: 82 },
    { x: width - 54, y: 82 },
    { x: center, y: 274 },
  ]
  return positions[index] ?? positions[5]
}

const buildGraphScene = (navigation: GraphNavigation): GraphScene => {
  const previousEntry = navigation.history.at(-1)
  const previousEntity = previousEntry?.entity
  const graphRelations = splitStrongEntityRelations(navigation.activeEntity).graph
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
    previousPositionIndex,
    relationNodes: page.relations.map((relation, index) => ({
      key: `relation:${relation.relation}:${relation.targetUniqueName ?? relation.targetName}`,
      positionIndex: relationPositionIndexes[index],
      relation,
    })),
  }
}

const EntityGraphNode = ({
  name,
  category,
  type,
  center = false,
  avatarProgress,
  avatarRole,
}: {
  name: string
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
    <VStack alignItems="center" gap={4} overflow="visible">
      <AnimatedBox
        size={center ? 82 : 58}
        borderRadius={center ? 41 : 29}
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
      <Text bold fontSize={center ? 15 : 12} textAlign="center" numberOfLines={2}>
        {name}
      </Text>
    </VStack>
  )
}

const GraphSatelliteContent = ({
  name,
  category,
  type,
  label,
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
  back: boolean
  avatarProgress?: SharedValue<number>
  avatarRole?: 'selected'
  disabled: boolean
  onPress: () => void
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={`${label}, ${name}`}
  >
    <Box width={SATELLITE_WIDTH} position="relative" alignItems="center">
      {back && (
        <Box position="absolute" left={0} top={21}>
          <FeatherIcon name="chevron-left" color="tertiary" size={16} />
        </Box>
      )}
      <EntityGraphNode
        name={name}
        category={category}
        type={type}
        avatarProgress={avatarProgress}
        avatarRole={avatarRole}
      />
      {!back && (
        <Box bg="lightPrimary" borderRadius={12} px={7} py={3} mt={3} maxWidth={SATELLITE_WIDTH}>
          <Text color="primary" fontSize={9} bold numberOfLines={1}>
            {label}
          </Text>
        </Box>
      )}
    </Box>
  </Pressable>
)

const SceneOpacity = ({
  progress,
  mode,
  children,
}: {
  progress: SharedValue<number>
  mode: 'idle' | 'outgoing' | 'incoming'
  children: React.ReactNode
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.get()
    return {
      opacity: mode === 'idle' ? 1 : mode === 'incoming' ? value : 1 - value,
    }
  })

  return (
    <AnimatedBox position="absolute" inset={0} style={animatedStyle}>
      {children}
    </AnimatedBox>
  )
}

const OutgoingNodeMotion = ({
  progress,
  role,
  children,
}: {
  progress: SharedValue<number>
  role: 'center' | 'selected' | 'relation'
  children: React.ReactNode
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.get()
    const scale =
      role === 'selected'
        ? interpolate(value, [0, 1], [1, 1.42], Extrapolation.CLAMP)
        : role === 'center'
          ? interpolate(value, [0, 1], [1, 0.71], Extrapolation.CLAMP)
          : 1

    return {
      transform: [{ scale }],
    }
  })

  return (
    <AnimatedBox overflow="visible" style={animatedStyle}>
      {children}
    </AnimatedBox>
  )
}

const IncomingNodeMotion = ({
  progress,
  role,
  children,
}: {
  progress: SharedValue<number>
  role: 'center' | 'previous'
  children: React.ReactNode
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.get()
    return {
      transform: [
        {
          scale:
            role === 'center'
              ? interpolate(value, [0, 1], [0.71, 1], Extrapolation.CLAMP)
              : interpolate(value, [0, 1], [1.42, 1], Extrapolation.CLAMP),
        },
      ],
    }
  })

  return (
    <AnimatedBox overflow="visible" style={animatedStyle}>
      {children}
    </AnimatedBox>
  )
}

const GraphSceneLayer = ({
  scene,
  width,
  mode,
  progress,
  selectedUniqueName,
  selectedPositionIndex,
  departingUniqueName,
  onOpenRelation,
  onGoBack,
}: {
  scene: GraphScene
  width: number
  mode: 'idle' | 'outgoing' | 'incoming'
  progress: SharedValue<number>
  selectedUniqueName?: string
  selectedPositionIndex?: number
  departingUniqueName?: string
  onOpenRelation: (relation: StrongLexiconEntityRelation, positionIndex: number) => void
  onGoBack: () => void
}) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const center = { x: width / 2, y: CENTER_Y }
  const selectedPosition =
    selectedPositionIndex == null ? center : graphPosition(selectedPositionIndex, width)
  const cameraOffset = {
    x: center.x - selectedPosition.x,
    y: center.y - selectedPosition.y,
  }
  const cameraStyle = useAnimatedStyle(() => {
    const value = progress.get()
    const translateX =
      mode === 'outgoing'
        ? cameraOffset.x * value
        : mode === 'incoming'
          ? -cameraOffset.x * (1 - value)
          : 0
    const translateY =
      mode === 'outgoing'
        ? cameraOffset.y * value
        : mode === 'incoming'
          ? -cameraOffset.y * (1 - value)
          : 0
    return {
      transform: [{ translateX }, { translateY }],
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
      <Box position="absolute" left={center.x - 48} top={108} width={96}>
        {mode === 'outgoing' && selectedUniqueName ? (
          <OutgoingNodeMotion progress={progress} role="center">
            <EntityGraphNode
              name={scene.navigation.activeEntity.name}
              category={scene.navigation.activeEntity.category}
              type={scene.navigation.activeEntity.type}
              center
              avatarProgress={progress}
              avatarRole="center"
            />
          </OutgoingNodeMotion>
        ) : mode === 'incoming' && selectedUniqueName ? (
          <IncomingNodeMotion progress={progress} role="center">
            <EntityGraphNode
              name={scene.navigation.activeEntity.name}
              category={scene.navigation.activeEntity.category}
              type={scene.navigation.activeEntity.type}
              center
            />
          </IncomingNodeMotion>
        ) : (
          <EntityGraphNode
            name={scene.navigation.activeEntity.name}
            category={scene.navigation.activeEntity.category}
            type={scene.navigation.activeEntity.type}
            center
          />
        )}
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
            back={false}
            avatarProgress={
              mode === 'outgoing' && uniqueName === selectedUniqueName ? progress : undefined
            }
            avatarRole={
              mode === 'outgoing' && uniqueName === selectedUniqueName ? 'selected' : undefined
            }
            disabled={!uniqueName || mode === 'outgoing'}
            onPress={() => onOpenRelation(relation, node.positionIndex)}
          />
        )

        return (
          <Box
            key={node.key}
            position="absolute"
            left={position.x - SATELLITE_WIDTH / 2}
            top={position.y - SATELLITE_TOP_OFFSET}
            width={SATELLITE_WIDTH}
            alignItems="center"
          >
            {mode === 'outgoing' ? (
              <OutgoingNodeMotion
                progress={progress}
                role={uniqueName === selectedUniqueName ? 'selected' : 'relation'}
              >
                {content}
              </OutgoingNodeMotion>
            ) : mode === 'incoming' && uniqueName === departingUniqueName ? (
              <IncomingNodeMotion progress={progress} role="previous">
                {content}
              </IncomingNodeMotion>
            ) : (
              content
            )}
          </Box>
        )
      })}

      {scene.previousEntity && scene.previousPositionIndex != null && (
        <Box
          position="absolute"
          left={graphPosition(scene.previousPositionIndex, width).x - SATELLITE_WIDTH / 2}
          top={graphPosition(scene.previousPositionIndex, width).y - SATELLITE_TOP_OFFSET}
          width={SATELLITE_WIDTH}
          alignItems="center"
        >
          {mode === 'outgoing' ? (
            <OutgoingNodeMotion
              progress={progress}
              role={
                scene.previousEntity.uniqueName === selectedUniqueName ? 'selected' : 'relation'
              }
            >
              <GraphSatelliteContent
                name={scene.previousEntity.name}
                category={scene.previousEntity.category}
                type={scene.previousEntity.type}
                label={t('strongDetail.entity.graphBack')}
                back
                avatarProgress={
                  scene.previousEntity.uniqueName === selectedUniqueName ? progress : undefined
                }
                avatarRole={
                  scene.previousEntity.uniqueName === selectedUniqueName ? 'selected' : undefined
                }
                disabled
                onPress={onGoBack}
              />
            </OutgoingNodeMotion>
          ) : mode === 'incoming' && scene.previousEntity.uniqueName === departingUniqueName ? (
            <IncomingNodeMotion progress={progress} role="previous">
              <GraphSatelliteContent
                name={scene.previousEntity.name}
                category={scene.previousEntity.category}
                type={scene.previousEntity.type}
                label={t('strongDetail.entity.graphBack')}
                back
                disabled
                onPress={onGoBack}
              />
            </IncomingNodeMotion>
          ) : (
            <GraphSatelliteContent
              name={scene.previousEntity.name}
              category={scene.previousEntity.category}
              type={scene.previousEntity.type}
              label={t('strongDetail.entity.graphBack')}
              back
              disabled={false}
              onPress={onGoBack}
            />
          )}
        </Box>
      )}
    </>
  )

  return (
    <AnimatedBox
      position="absolute"
      inset={0}
      pointerEvents={mode === 'outgoing' ? 'none' : 'auto'}
      style={cameraStyle}
    >
      <SceneOpacity progress={progress} mode={mode}>
        {connections}
        {nodes}
      </SceneOpacity>
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
  const [navigation, setNavigation] = useState<GraphNavigation>({
    activeEntity: entity,
    history: [],
    requestedPageIndex: 0,
  })
  const [transition, setTransition] = useState<GraphTransition>()
  const transitionProgress = useSharedValue(1)
  const nextTransitionId = useRef(0)
  const activeTransitionId = useRef<number | undefined>(undefined)
  const latestRelationRequestId = useRef(0)

  useEffect(() => {
    activeTransitionId.current = undefined
    cancelAnimation(transitionProgress)
    setNavigation({
      activeEntity: entity,
      history: [],
      requestedPageIndex: 0,
    })
    setTransition(undefined)

    transitionProgress.set(1)
  }, [entity, transitionProgress])

  const activeScene = buildGraphScene(navigation)
  const preloadScene = transition?.to ?? activeScene
  const visibleTargetNames = preloadScene.page.relations
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

  const finishTransition = useEffectEvent((transitionId: number) => {
    if (activeTransitionId.current !== transitionId) return
    activeTransitionId.current = undefined
    setTransition(undefined)
    transitionProgress.set(1)
  })

  useEffect(() => {
    if (!transition) return

    transitionProgress.set(
      withSpring(1, { duration: 400 }, finished => {
        if (finished) runOnJS(finishTransition)(transition.id)
      })
    )
  }, [transition, transitionProgress])

  const beginTransition = ({
    to,
    kind,
    selectedUniqueName,
    selectedPositionIndex,
  }: {
    to: GraphNavigation
    kind: GraphTransition['kind']
    selectedUniqueName?: string
    selectedPositionIndex?: number
  }) => {
    if (reduceMotion) {
      setNavigation(to)
      return
    }

    cancelAnimation(transitionProgress)
    const transitionId = ++nextTransitionId.current
    activeTransitionId.current = transitionId
    transitionProgress.set(0)
    setTransition({
      id: transitionId,
      kind,
      from: activeScene,
      to: buildGraphScene(to),
      selectedUniqueName,
      selectedPositionIndex,
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
        history: [
          ...navigation.history,
          {
            entity: navigation.activeEntity,
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
    if (!previousEntry || transition) return

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

  const goToPage = (nextPageIndex: number) => {
    if (nextPageIndex === activeScene.page.pageIndex || transition) return
    beginTransition({
      kind: 'fade',
      to: {
        ...navigation,
        requestedPageIndex: nextPageIndex,
      },
    })
  }

  const graphRelations = splitStrongEntityRelations(navigation.activeEntity).graph
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
        {transition ? (
          <>
            <GraphSceneLayer
              scene={transition.to}
              width={width}
              mode="incoming"
              progress={transitionProgress}
              selectedUniqueName={transition.selectedUniqueName}
              selectedPositionIndex={transition.selectedPositionIndex}
              departingUniqueName={transition.from.navigation.activeEntity.uniqueName}
              onOpenRelation={openRelation}
              onGoBack={goBack}
            />
            <GraphSceneLayer
              scene={transition.from}
              width={width}
              mode="outgoing"
              progress={transitionProgress}
              selectedUniqueName={transition.selectedUniqueName}
              selectedPositionIndex={transition.selectedPositionIndex}
              departingUniqueName={transition.from.navigation.activeEntity.uniqueName}
              onOpenRelation={openRelation}
              onGoBack={goBack}
            />
          </>
        ) : (
          <GraphSceneLayer
            scene={activeScene}
            width={width}
            mode="idle"
            progress={transitionProgress}
            onOpenRelation={openRelation}
            onGoBack={goBack}
          />
        )}
      </Box>

      {activeScene.page.pageCount > 1 && (
        <HStack
          height={44}
          center
          gap={18}
          borderTopWidth={1}
          borderColor="border"
          accessibilityLabel={t('strongDetail.entity.graphPage', {
            current: activeScene.page.pageIndex + 1,
            count: activeScene.page.pageCount,
          })}
        >
          <TouchableBox
            size={32}
            borderRadius={16}
            bg="lightGrey"
            center
            disabled={activeScene.page.pageIndex === 0 || Boolean(transition)}
            onPress={() => goToPage(activeScene.page.pageIndex - 1)}
            accessibilityRole="button"
            accessibilityLabel={t('strongDetail.entity.graphPreviousPage')}
            accessibilityState={{
              disabled: activeScene.page.pageIndex === 0 || Boolean(transition),
            }}
          >
            <FeatherIcon name="chevron-left" color="primary" size={18} />
          </TouchableBox>
          <Text bold color="tertiary" fontSize={12}>
            {activeScene.page.pageIndex + 1} / {activeScene.page.pageCount}
          </Text>
          <TouchableBox
            size={32}
            borderRadius={16}
            bg="lightGrey"
            center
            disabled={
              activeScene.page.pageIndex === activeScene.page.pageCount - 1 || Boolean(transition)
            }
            onPress={() => goToPage(activeScene.page.pageIndex + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('strongDetail.entity.graphNextPage')}
            accessibilityState={{
              disabled:
                activeScene.page.pageIndex === activeScene.page.pageCount - 1 ||
                Boolean(transition),
            }}
          >
            <FeatherIcon name="chevron-right" color="primary" size={18} />
          </TouchableBox>
        </HStack>
      )}
    </VStack>
  )
}
