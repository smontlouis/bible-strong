import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import {
  Easing,
  type EntryExitAnimationFunction,
  FadeOut,
  type SharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../OnboardingStage'
import SceneBackgroundShape from '../SceneBackgroundShape'
import SceneActionButton from '../SceneActionButton'
import SceneDecorativePluses from '../SceneDecorativePluses'
import { Scene } from '../SceneGraph'
import VerseCard, { type HighlightColor } from '../VerseCard'
import { AbelSourceCard, HevelSourceCard, SourceCard } from './GenesisSourceCard'
import NoteCard from './NoteCard'

const RELATION_ENTER_START = 420
const RELATION_STAGGER = 90
export const SCENE_SIX_DEPTH_EXIT = {
  vanishingFrame: { x: 32, y: 83, width: 286, height: 314 },
  cameraTravel: 0.9,
  nearDistance: 1,
  farDistance: 2.5,
  maxProjection: 999,
  duration: 800,
  movementEasing: Easing.in(Easing.poly(6)),
  opacityStartProgress: 0.8,
  graphDuration: 500,
} as const

export const SCENE_SIX_DEPTH_DEBUG = {
  enabled: false,
  backgroundColor: '#000000',
  itemColor: '#FFFFFF',
  farOpacity: 0.24,
  nearOpacity: 1,
} as const

const GRAPH_EXIT = FadeOut.duration(SCENE_SIX_DEPTH_EXIT.graphDuration)

type DepthNodeFrame = {
  x: number
  y: number
  width: number
  height: number
}

type DepthNodePerspective = {
  depth: number
}

type DepthMapNodeProps = {
  depth: number
  metrics: OnboardingStageMetrics
}

const DepthMapNode = ({ depth, metrics }: DepthMapNodeProps) => {
  const normalizedDepth = Math.max(0, Math.min(1, depth))
  const opacity =
    SCENE_SIX_DEPTH_DEBUG.farOpacity +
    (SCENE_SIX_DEPTH_DEBUG.nearOpacity - SCENE_SIX_DEPTH_DEBUG.farOpacity) * normalizedDepth

  return (
    <Box
      flex
      borderRadius={metrics.s(12)}
      style={{
        backgroundColor: SCENE_SIX_DEPTH_DEBUG.itemColor,
        opacity,
      }}
    />
  )
}

const DEPTH_NODE_FRAMES = {
  abelSource: { x: 35, y: 137, width: 140, height: 74 },
  hevelSource: { x: 190, y: 100, width: 154, height: 74 },
  ecclesiastes: { x: 130, y: 200, width: 170, height: 60 },
  note: { x: 35, y: 322, width: 120, height: 60 },
  study: { x: 220, y: 325, width: 130, height: 70 },
} as const satisfies Record<string, DepthNodeFrame>

const DEPTH_NODES = {
  abelSource: { depth: 0.6 },
  hevelSource: { depth: 0.4 },
  ecclesiastes: { depth: 0.9 },
  note: { depth: 0.2 },
  study: { depth: 0.6 },
} as const satisfies Record<keyof typeof DEPTH_NODE_FRAMES, DepthNodePerspective>

const createDepthExit = (
  metrics: OnboardingStageMetrics,
  frame: DepthNodeFrame,
  perspective: DepthNodePerspective,
  navigationDirection: SharedValue<1 | -1>
): EntryExitAnimationFunction => {
  const depth = Math.max(0, Math.min(1, perspective.depth))
  const duration = SCENE_SIX_DEPTH_EXIT.duration
  const movementEasing = SCENE_SIX_DEPTH_EXIT.movementEasing
  const opacityEasing = Easing.linear
  const opacityStartProgress = Math.max(0, Math.min(1, SCENE_SIX_DEPTH_EXIT.opacityStartProgress))
  const opacityDelay = duration * opacityStartProgress
  const opacityDuration = duration - opacityDelay
  const vanishingPointX =
    SCENE_SIX_DEPTH_EXIT.vanishingFrame.x + SCENE_SIX_DEPTH_EXIT.vanishingFrame.width / 2
  const vanishingPointY =
    SCENE_SIX_DEPTH_EXIT.vanishingFrame.y + SCENE_SIX_DEPTH_EXIT.vanishingFrame.height / 2
  const nodeCenterX = frame.x + frame.width / 2
  const nodeCenterY = frame.y + frame.height / 2
  const initialDistance =
    SCENE_SIX_DEPTH_EXIT.farDistance -
    (SCENE_SIX_DEPTH_EXIT.farDistance - SCENE_SIX_DEPTH_EXIT.nearDistance) * depth
  const finalDistance = Math.max(0.05, initialDistance - SCENE_SIX_DEPTH_EXIT.cameraTravel)
  const projection = Math.min(SCENE_SIX_DEPTH_EXIT.maxProjection, initialDistance / finalDistance)
  const translateX = (nodeCenterX - vanishingPointX) * (projection - 1) * metrics.scale
  const translateY = (nodeCenterY - vanishingPointY) * (projection - 1) * metrics.scale

  return () => {
    'worklet'

    if (navigationDirection.get() < 0) {
      return {
        initialValues: {
          opacity: 1,
          transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
        },
        animations: {
          opacity: withSpring(0),
          transform: [
            { translateX: withSpring(0) },
            { translateY: withSpring(0) },
            { scale: withSpring(1) },
          ],
        },
      }
    }

    return {
      initialValues: {
        opacity: 1,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      },
      animations: {
        opacity: withDelay(
          opacityDelay,
          withTiming(0, { duration: opacityDuration, easing: opacityEasing })
        ),
        transform: [
          {
            translateX: withTiming(translateX, { duration, easing: movementEasing }),
          },
          {
            translateY: withTiming(translateY, { duration, easing: movementEasing }),
          },
          {
            scale: withTiming(projection, { duration, easing: movementEasing }),
          },
        ],
      },
    }
  }
}

type SceneSixElementProps = {
  metrics: OnboardingStageMetrics
  t: TFunction
}

const AbelTag = ({ metrics }: { metrics: OnboardingStageMetrics }) => (
  <HStack
    flex
    bg="reverse"
    borderRadius={metrics.s(8)}
    px={metrics.s(10)}
    alignItems="center"
    gap={metrics.s(5)}
    lightShadow
  >
    <Feather name="tag" size={metrics.s(12)} color="#F2B94B" />
    <Text bold fontSize={metrics.s(10)} style={{ fontFamily: 'Courier' }}>
      Abel
    </Text>
  </HStack>
)

type RelationLabelProps = {
  color: string
  label: string
  metrics: OnboardingStageMetrics
}

const RelationLabel = ({ color, label, metrics }: RelationLabelProps) => (
  <Box
    flex
    borderRadius={metrics.s(8)}
    center
    style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
  >
    <Text bold fontSize={metrics.s(9)} style={{ color, fontFamily: 'Courier' }}>
      {label}
    </Text>
  </Box>
)

type CreateSceneSixRelationsProps = SceneSixElementProps & {
  depthDebug?: boolean
  highlightColor: HighlightColor
  navigationDirection: SharedValue<1 | -1>
  onCollapsePress: () => void
  reduceMotion: boolean
  shakeRotations: {
    abel: SharedValue<number>
    hevel: SharedValue<number>
  }
}

export const createSceneSixRelations = ({
  depthDebug = SCENE_SIX_DEPTH_DEBUG.enabled,
  highlightColor,
  metrics,
  navigationDirection,
  onCollapsePress,
  reduceMotion,
  shakeRotations,
  t,
}: CreateSceneSixRelationsProps) => {
  const abelSourceExiting = createDepthExit(
    metrics,
    DEPTH_NODE_FRAMES.abelSource,
    DEPTH_NODES.abelSource,
    navigationDirection
  )
  const hevelSourceExiting = createDepthExit(
    metrics,
    DEPTH_NODE_FRAMES.hevelSource,
    DEPTH_NODES.hevelSource,
    navigationDirection
  )
  const ecclesiastesExiting = createDepthExit(
    metrics,
    DEPTH_NODE_FRAMES.ecclesiastes,
    DEPTH_NODES.ecclesiastes,
    navigationDirection
  )
  const noteExiting = createDepthExit(
    metrics,
    DEPTH_NODE_FRAMES.note,
    DEPTH_NODES.note,
    navigationDirection
  )
  const studyExiting = createDepthExit(
    metrics,
    DEPTH_NODE_FRAMES.study,
    DEPTH_NODES.study,
    navigationDirection
  )

  return (
    <Scene id="scene-six">
      <Scene.Layer zIndex={0}>
        <Box
          absoluteFill
          borderRadius={metrics.s(22)}
          style={{
            backgroundColor: depthDebug ? SCENE_SIX_DEPTH_DEBUG.backgroundColor : '#F7F9FF',
          }}
        />
      </Scene.Layer>

      {!depthDebug && (
        <Scene.Node
          id="scene-background"
          layout="resize"
          frame={{ ...SCENE_SIX_DEPTH_EXIT.vanishingFrame, opacity: 0.72, zIndex: 1 }}
          pointerEvents="none"
        >
          <SceneBackgroundShape borderRadius={metrics.s(30)} reduceMotion={reduceMotion} />
        </Scene.Node>
      )}

      {!depthDebug && (
        <Scene.Node
          id="abel-tag"
          frame={{ x: 57, y: 69, width: 76, height: 28, zIndex: 7 }}
          enterDelay={180}
          enterFrom={{ x: 0, y: 14 }}
          exiting={GRAPH_EXIT}
          draggable
          dragFriction={0.1}
        >
          <AbelTag metrics={metrics} />
        </Scene.Node>
      )}

      <Scene.Node
        id="verse-card"
        layout="scale"
        frame={{
          x: -16,
          y: 93,
          width: 382,
          height: 294,
          scale: 0.38,
          opacity: 0,
          zIndex: 2,
        }}
        draggable
        dragFriction={0.1}
      >
        <VerseCard
          mode="small"
          reduceMotion={reduceMotion}
          highlightColor={highlightColor}
          metrics={metrics}
        />
      </Scene.Node>

      <Scene.Node
        id="abel-source"
        layout="resize"
        exiting={abelSourceExiting}
        contentExiting={false}
        frame={{
          ...DEPTH_NODE_FRAMES.abelSource,
          zIndex: 5,
          anchors: { explains: { x: 0.5, y: 1 } },
        }}
        draggable
        dragFriction={0.1}
      >
        {depthDebug ? (
          <DepthMapNode depth={DEPTH_NODES.abelSource.depth} metrics={metrics} />
        ) : (
          <AbelSourceCard metrics={metrics} shakeRotation={shakeRotations.abel} t={t} />
        )}
      </Scene.Node>

      <Scene.Node
        id="strong-stack"
        layout="resize"
        exiting={hevelSourceExiting}
        contentExiting={false}
        frame={{
          ...DEPTH_NODE_FRAMES.hevelSource,
          zIndex: 5,
          anchors: { mentions: { x: 0.5, y: 1 } },
        }}
        draggable
        dragFriction={0.1}
      >
        {depthDebug ? (
          <DepthMapNode depth={DEPTH_NODES.hevelSource.depth} metrics={metrics} />
        ) : (
          <HevelSourceCard metrics={metrics} shakeRotation={shakeRotations.hevel} t={t} />
        )}
      </Scene.Node>

      <Scene.Node
        id="ecclesiastes-occurrence"
        exiting={ecclesiastesExiting}
        contentExiting={false}
        frame={{
          ...DEPTH_NODE_FRAMES.ecclesiastes,
          zIndex: 6,
          anchors: { referencedBy: { x: 0.5, y: 1 } },
        }}
        enterDelay={270}
        enterFrom={{ x: 0, y: -20 }}
        draggable
        dragFriction={0.1}
      >
        {depthDebug ? (
          <DepthMapNode depth={DEPTH_NODES.ecclesiastes.depth} metrics={metrics} />
        ) : (
          <SourceCard
            label={String(t('onboarding.abel.sceneSix.ecclesiastesDetail')).toUpperCase()}
            markerColor="#FF8400"
            metrics={metrics}
            title={t('onboarding.abel.sceneSix.ecclesiastesTitle')}
            variant="small"
          />
        )}
      </Scene.Node>

      <Scene.Node
        id="question-note"
        layout="resize"
        exiting={noteExiting}
        contentExiting={false}
        frame={{
          ...DEPTH_NODE_FRAMES.note,
          zIndex: 6,
          anchors: {
            explains: { x: 0.34, y: 0 },
            references: { x: 0.72, y: 0 },
            mentions: { x: 1, y: 0.45 },
            linkedTo: { x: 1, y: 0.78 },
          },
        }}
        draggable
        dragFriction={0.1}
      >
        {depthDebug ? (
          <DepthMapNode depth={DEPTH_NODES.note.depth} metrics={metrics} />
        ) : (
          <NoteCard metrics={metrics} t={t} variant="small">
            <Text
              fontSize={metrics.s(14)}
              lineHeight={metrics.s(18)}
              mt={metrics.s(9)}
              style={{ fontFamily: 'Courier' }}
            >
              Abel
            </Text>
          </NoteCard>
        )}
      </Scene.Node>

      <Scene.Node
        id="study-card"
        exiting={studyExiting}
        contentExiting={false}
        frame={{
          ...DEPTH_NODE_FRAMES.study,
          zIndex: 6,
          anchors: { linkedFrom: { x: 0, y: 0.6 } },
        }}
        enterDelay={360}
        enterFrom={{ x: -22, y: 12 }}
        draggable
        dragFriction={0.1}
      >
        {depthDebug ? (
          <DepthMapNode depth={DEPTH_NODES.study.depth} metrics={metrics} />
        ) : (
          <SourceCard
            label={String(t('onboarding.abel.sceneSix.studyTitle')).toUpperCase()}
            markerColor="#AFC4FF"
            metrics={metrics}
            title={t('onboarding.abel.sceneSix.studyDetail')}
            variant="small"
          />
        )}
      </Scene.Node>

      {!depthDebug && (
        <Scene.Connection
          from={{ node: 'question-note', anchor: 'center' }}
          to={{ node: 'abel-source', anchor: 'bottom' }}
          curve={{ type: 'quadratic', bend: -0.16 }}
          color="#5983F0"
          opacity={0.68}
          width={1.4}
          enterDelay={RELATION_ENTER_START}
          exiting={GRAPH_EXIT}
        />
      )}
      {!depthDebug && (
        <Scene.Connection
          from={{ node: 'question-note', anchor: 'center' }}
          to={{ node: 'ecclesiastes-occurrence', anchor: 'referencedBy' }}
          curve={{ type: 'quadratic', bend: 0.12 }}
          color="#FF8400"
          opacity={0.72}
          width={1.4}
          enterDelay={RELATION_ENTER_START + RELATION_STAGGER}
          exiting={GRAPH_EXIT}
        />
      )}
      {!depthDebug && (
        <Scene.Connection
          from={{ node: 'question-note', anchor: 'center' }}
          to={{ node: 'strong-stack', anchor: 'bottom' }}
          curve={{ type: 'quadratic', bend: -0.16 }}
          color="#FF7675"
          opacity={0.72}
          width={1.4}
          enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 2}
          exiting={GRAPH_EXIT}
        />
      )}
      {!depthDebug && (
        <Scene.Connection
          from={{ node: 'question-note', anchor: 'center' }}
          to={{ node: 'study-card', anchor: 'linkedFrom' }}
          curve={{ type: 'quadratic', bend: -0.08 }}
          color="#AFC4FF"
          opacity={0.8}
          width={1.4}
          enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 3}
          exiting={GRAPH_EXIT}
        />
      )}

      {!depthDebug && (
        <Scene.Node
          id="relation-label-explains"
          frame={{ x: 50, y: 264, width: 62, height: 20, zIndex: 7 }}
          enterDelay={RELATION_ENTER_START}
          enterFrom={{ x: 0, y: 8 }}
          exiting={GRAPH_EXIT}
          pointerEvents="none"
        >
          <RelationLabel
            color="#5983F0"
            label={t('onboarding.abel.sceneSix.explains')}
            metrics={metrics}
          />
        </Scene.Node>
      )}
      {!depthDebug && (
        <Scene.Node
          id="relation-label-references"
          frame={{ x: 140, y: 290, width: 70, height: 20, zIndex: 7 }}
          enterDelay={RELATION_ENTER_START + RELATION_STAGGER}
          enterFrom={{ x: 0, y: 8 }}
          exiting={GRAPH_EXIT}
          pointerEvents="none"
        >
          <RelationLabel
            color="#B76A00"
            label={t('onboarding.abel.sceneSix.references')}
            metrics={metrics}
          />
        </Scene.Node>
      )}
      {!depthDebug && (
        <Scene.Node
          id="relation-label-mentions"
          frame={{ x: 120, y: 264, width: 68, height: 20, zIndex: 7 }}
          enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 2}
          enterFrom={{ x: 0, y: 8 }}
          exiting={GRAPH_EXIT}
          pointerEvents="none"
        >
          <RelationLabel
            color="#FF7675"
            label={t('onboarding.abel.sceneSix.mentions')}
            metrics={metrics}
          />
        </Scene.Node>
      )}
      {!depthDebug && (
        <Scene.Node
          id="relation-label-linked"
          frame={{ x: 164, y: 350, width: 48, height: 20, zIndex: 7 }}
          enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 3}
          enterFrom={{ x: 0, y: 8 }}
          exiting={GRAPH_EXIT}
          pointerEvents="none"
        >
          <RelationLabel
            color="#5983F0"
            label={t('onboarding.abel.sceneSix.linkedTo')}
            metrics={metrics}
          />
        </Scene.Node>
      )}

      {!depthDebug && (
        <Scene.Node
          id="relations-action"
          frame={{ x: 303, y: 271, width: 36, height: 36, zIndex: 9 }}
          enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 4}
          enterFrom={{ scale: 0.5 }}
          exitTo={{ scale: 1.5 }}
          onPress={onCollapsePress}
          pressScale={0.96}
          accessibilityLabel={t('onboarding.abel.sceneSix.closeRelations')}
        >
          <SceneActionButton icon="maximize-2" metrics={metrics} />
        </Scene.Node>
      )}

      {!depthDebug && (
        <SceneDecorativePluses metrics={metrics} reduceMotion={reduceMotion} scene="six" />
      )}
    </Scene>
  )
}
