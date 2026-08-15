import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import { ZoomIn } from 'react-native-reanimated'

import LexiqueIcon from '~common/LexiqueIcon'
import { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../OnboardingStage'
import SceneBackgroundShape from '../SceneBackgroundShape'
import SceneDecorativePluses from '../SceneDecorativePluses'
import { Scene } from '../SceneGraph'
import VerseCard, { type HighlightColor } from '../VerseCard'

export const SCENE_SEVEN_REVEAL = {
  verseDelay: 1200,
  verseDuration: 1350,
  promptDelay: 1800,
  nodeStart: 2350,
  nodeStagger: 100,
  actionDelay: 1800,
} as const

export const SCENE_SEVEN_ORBIT = {
  centerX: 175,
  centerY: 245,
  radiusX: 165,
  radiusY: 75,
  rotationDegrees: -50,
  frontPhase: 0.2,
  duration: 16000,
  startDelay: 0,
  direction: 1 as const,
  minScale: 0.76,
  maxScale: 1.16,
  minOpacity: 0.4,
  maxOpacity: 1,
  backZIndex: 3,
  frontZIndex: 8,
} as const

type FinalChipProps = {
  color: string
  icon: keyof typeof Feather.glyphMap | 'lexique'
  label: string
  metrics: OnboardingStageMetrics
}

const FinalChip = ({ color, icon, label, metrics }: FinalChipProps) => (
  <HStack
    flex
    px={metrics.s(9)}
    borderRadius={metrics.s(18)}
    alignItems="center"
    justifyContent="center"
    gap={metrics.s(5)}
    lightShadow
    style={{ backgroundColor: 'rgba(255,255,255,0.94)' }}
  >
    {icon === 'lexique' ? (
      <LexiqueIcon size={metrics.s(14)} color={color} />
    ) : (
      <Feather name={icon} size={metrics.s(14)} color={color} />
    )}
    <Text bold fontSize={metrics.s(10)} numberOfLines={1}>
      {label}
    </Text>
  </HStack>
)

type CreateSceneSevenReturnToVerseProps = {
  highlightColor: HighlightColor
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  t: TFunction
}

const revealDelay = (order: number) =>
  SCENE_SEVEN_REVEAL.nodeStart + order * SCENE_SEVEN_REVEAL.nodeStagger

const orbitAt = (phase: number) => ({ ...SCENE_SEVEN_ORBIT, phase })
const revealOrbitContent = (order: number) => ZoomIn.delay(revealDelay(order)).springify()

export const createSceneSevenReturnToVerse = ({
  highlightColor,
  metrics,
  reduceMotion,
  t,
}: CreateSceneSevenReturnToVerseProps) => (
  <Scene id="scene-seven">
    <Scene.Node
      id="scene-background"
      layout="resize"
      transitionDelay={SCENE_SEVEN_REVEAL.verseDelay}
      transitionDuration={SCENE_SEVEN_REVEAL.verseDuration}
      frame={{ x: 15, y: 58, width: 320, height: 320, opacity: 0.52, zIndex: 1 }}
      pointerEvents="none"
    >
      <SceneBackgroundShape borderRadius={metrics.s(160)} reduceMotion={reduceMotion} />
    </Scene.Node>

    <Scene.Node
      id="verse-card"
      layout="scale"
      transitionDelay={SCENE_SEVEN_REVEAL.verseDelay}
      transitionDuration={SCENE_SEVEN_REVEAL.verseDuration}
      frame={{
        x: -16,
        y: 81,
        width: 382,
        height: 294,
        scale: 0.6,
        zIndex: 5,
        anchors: {
          note: { x: 0.16, y: 0.18 },
          abel: { x: 0.84, y: 0.18 },
          h1893: { x: 0.04, y: 0.52 },
          h1892: { x: 0.96, y: 0.52 },
          study: { x: 0.25, y: 0.9 },
          ecclesiastes: { x: 0.74, y: 0.9 },
        },
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
      id="final-note-chip"
      frame={{ x: -4, y: 62, width: 76, height: 30, zIndex: 7 }}
      orbit={orbitAt(0.84)}
      entering={false}
      contentEntering={revealOrbitContent(5)}
    >
      <FinalChip
        color="#FF7675"
        icon="file-text"
        label={t('onboarding.abel.sceneSeven.note')}
        metrics={metrics}
      />
    </Scene.Node>

    <Scene.Node
      id="final-abel-chip"
      frame={{ x: 276, y: 50, width: 66, height: 32, zIndex: 7 }}
      orbit={orbitAt(0)}
      entering={false}
      contentEntering={revealOrbitContent(0)}
    >
      <FinalChip color="#F2B94B" icon="tag" label="Abel" metrics={metrics} />
    </Scene.Node>

    <Scene.Node
      id="final-h1893-chip"
      frame={{ x: -7, y: 205, width: 78, height: 30, zIndex: 7 }}
      orbit={orbitAt(0.68)}
      entering={false}
      contentEntering={revealOrbitContent(4)}
    >
      <FinalChip color="#5983F0" icon="lexique" label="H1893" metrics={metrics} />
    </Scene.Node>

    <Scene.Node
      id="final-h1892-chip"
      frame={{ x: 279, y: 210, width: 72, height: 30, zIndex: 7 }}
      orbit={orbitAt(0.17)}
      entering={false}
      contentEntering={revealOrbitContent(1)}
    >
      <FinalChip color="#FF7675" icon="lexique" label="H1892" metrics={metrics} />
    </Scene.Node>

    <Scene.Node
      id="final-study-chip"
      frame={{ x: 18, y: 374, width: 76, height: 30, zIndex: 7 }}
      orbit={orbitAt(0.5)}
      entering={false}
      contentEntering={revealOrbitContent(3)}
    >
      <FinalChip
        color="#7D8FEA"
        icon="feather"
        label={t('onboarding.abel.sceneSeven.study')}
        metrics={metrics}
      />
    </Scene.Node>

    <Scene.Node
      id="final-ecclesiastes-chip"
      frame={{ x: 215, y: 374, width: 128, height: 30, zIndex: 7 }}
      orbit={orbitAt(0.34)}
      entering={false}
      contentEntering={revealOrbitContent(2)}
    >
      <FinalChip
        color="#FF8400"
        icon="book-open"
        label={t('onboarding.abel.sceneSeven.ecclesiastes')}
        metrics={metrics}
      />
    </Scene.Node>

    <SceneDecorativePluses metrics={metrics} reduceMotion={reduceMotion} scene="seven" />
  </Scene>
)
