import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import type { SharedValue } from 'react-native-reanimated'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import { Scene } from '../onboarding/SceneGraph'
import VerseCard, { type HighlightColor } from '../onboarding/VerseCard'
import { AbelSourceCard, HevelSourceCard, SourceCard } from './GenesisSourceCard'
import NoteCard from './NoteCard'

const RELATION_ENTER_START = 420
const RELATION_STAGGER = 90

type SceneSixElementProps = {
  metrics: OnboardingStageMetrics
  t: TFunction
}

const AbelTag = ({ metrics }: { metrics: OnboardingStageMetrics }) => (
  <HStack
    flex
    bg="primary"
    borderRadius={metrics.s(8)}
    px={metrics.s(10)}
    alignItems="center"
    gap={metrics.s(5)}
  >
    <Feather name="tag" size={metrics.s(12)} color="#FFFFFF" />
    <Text color="reverse" bold fontSize={metrics.s(10)} style={{ fontFamily: 'Courier' }}>
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
  highlightColor: HighlightColor
  reduceMotion: boolean
  shakeRotations: {
    abel: SharedValue<number>
    hevel: SharedValue<number>
  }
}

export const createSceneSixRelations = ({
  highlightColor,
  metrics,
  reduceMotion,
  shakeRotations,
  t,
}: CreateSceneSixRelationsProps) => (
  <Scene id="scene-six">
    <Scene.Layer zIndex={0}>
      <Box absoluteFill borderRadius={metrics.s(22)} style={{ backgroundColor: '#F7F9FF' }} />
    </Scene.Layer>

    <Scene.Node
      id="scene-background"
      layout="resize"
      frame={{ x: 32, y: 83, width: 286, height: 314, opacity: 0.72, zIndex: 1 }}
      pointerEvents="none"
    >
      <SceneBackgroundShape borderRadius={metrics.s(30)} reduceMotion={reduceMotion} />
    </Scene.Node>

    <Scene.Node
      id="abel-tag"
      frame={{ x: 57, y: 69, width: 76, height: 28, zIndex: 7 }}
      enterDelay={180}
      enterFrom={{ x: 0, y: 14 }}
      exitTo={{ x: 0, y: 14 }}
      draggable
      dragFriction={0.1}
    >
      <AbelTag metrics={metrics} />
    </Scene.Node>

    <Scene.Node
      id="verse-card"
      layout="scale"
      frame={{
        x: -16,
        y: 93,
        width: 382,
        height: 294,
        scale: 0.38,
        opacity: 0.1,
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
      frame={{
        x: 35,
        y: 137,
        width: 140,
        height: 74,
        zIndex: 5,
        anchors: { explains: { x: 0.5, y: 1 } },
      }}
      draggable
      dragFriction={0.1}
    >
      <AbelSourceCard metrics={metrics} shakeRotation={shakeRotations.abel} t={t} />
    </Scene.Node>

    <Scene.Node
      id="strong-stack"
      layout="resize"
      frame={{
        x: 190,
        y: 100,
        width: 154,
        height: 74,
        zIndex: 5,
        anchors: { mentions: { x: 0.5, y: 1 } },
      }}
      draggable
      dragFriction={0.1}
    >
      <HevelSourceCard metrics={metrics} shakeRotation={shakeRotations.hevel} t={t} />
    </Scene.Node>

    <Scene.Node
      id="ecclesiastes-occurrence"
      frame={{
        x: 130,
        y: 200,
        width: 170,
        height: 60,
        zIndex: 6,
        anchors: { referencedBy: { x: 0.5, y: 1 } },
      }}
      enterDelay={270}
      enterFrom={{ x: 0, y: -20 }}
      exitTo={{ x: 0, y: -20 }}
      draggable
      dragFriction={0.1}
    >
      <SourceCard
        label={String(t('playground.sceneSix.ecclesiastesDetail')).toUpperCase()}
        markerColor="#FF8400"
        metrics={metrics}
        title={t('playground.sceneSix.ecclesiastesTitle')}
        variant="small"
      />
    </Scene.Node>

    <Scene.Node
      id="question-note"
      layout="resize"
      frame={{
        x: 35,
        y: 322,
        width: 120,
        height: 60,
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
    </Scene.Node>

    <Scene.Node
      id="study-card"
      frame={{
        x: 220,
        y: 325,
        width: 130,
        height: 70,
        zIndex: 6,
        anchors: { linkedFrom: { x: 0, y: 0.6 } },
      }}
      enterDelay={360}
      enterFrom={{ x: -22, y: 12 }}
      exitTo={{ x: -22, y: 12 }}
      draggable
      dragFriction={0.1}
    >
      <SourceCard
        label={String(t('playground.sceneSix.studyTitle')).toUpperCase()}
        markerColor="#AFC4FF"
        metrics={metrics}
        title={t('playground.sceneSix.studyDetail')}
        variant="small"
      />
    </Scene.Node>

    <Scene.Connection
      from={{ node: 'question-note', anchor: 'center' }}
      to={{ node: 'abel-source', anchor: 'bottom' }}
      curve={{ type: 'quadratic', bend: -0.16 }}
      color="#5983F0"
      opacity={0.68}
      width={1.4}
      enterDelay={RELATION_ENTER_START}
    />
    <Scene.Connection
      from={{ node: 'question-note', anchor: 'center' }}
      to={{ node: 'ecclesiastes-occurrence', anchor: 'referencedBy' }}
      curve={{ type: 'quadratic', bend: 0.12 }}
      color="#FF8400"
      opacity={0.72}
      width={1.4}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER}
    />
    <Scene.Connection
      from={{ node: 'question-note', anchor: 'center' }}
      to={{ node: 'strong-stack', anchor: 'bottom' }}
      curve={{ type: 'quadratic', bend: -0.16 }}
      color="#FF7675"
      opacity={0.72}
      width={1.4}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 2}
    />
    <Scene.Connection
      from={{ node: 'question-note', anchor: 'center' }}
      to={{ node: 'study-card', anchor: 'linkedFrom' }}
      curve={{ type: 'quadratic', bend: -0.08 }}
      color="#AFC4FF"
      opacity={0.8}
      width={1.4}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 3}
    />

    <Scene.Node
      id="relation-label-explains"
      frame={{ x: 50, y: 264, width: 62, height: 20, zIndex: 7 }}
      enterDelay={RELATION_ENTER_START}
      enterFrom={{ x: 0, y: 8 }}
      exitTo={{ x: 0, y: 8 }}
      pointerEvents="none"
    >
      <RelationLabel color="#5983F0" label={t('playground.sceneSix.explains')} metrics={metrics} />
    </Scene.Node>
    <Scene.Node
      id="relation-label-references"
      frame={{ x: 140, y: 290, width: 70, height: 20, zIndex: 7 }}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER}
      enterFrom={{ x: 0, y: 8 }}
      exitTo={{ x: 0, y: 8 }}
      pointerEvents="none"
    >
      <RelationLabel
        color="#B76A00"
        label={t('playground.sceneSix.references')}
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="relation-label-mentions"
      frame={{ x: 120, y: 264, width: 68, height: 20, zIndex: 7 }}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 2}
      enterFrom={{ x: 0, y: 8 }}
      exitTo={{ x: 0, y: 8 }}
      pointerEvents="none"
    >
      <RelationLabel color="#FF7675" label={t('playground.sceneSix.mentions')} metrics={metrics} />
    </Scene.Node>
    <Scene.Node
      id="relation-label-linked"
      frame={{ x: 164, y: 350, width: 48, height: 20, zIndex: 7 }}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 3}
      enterFrom={{ x: 0, y: 8 }}
      exitTo={{ x: 0, y: 8 }}
      pointerEvents="none"
    >
      <RelationLabel color="#5983F0" label={t('playground.sceneSix.linkedTo')} metrics={metrics} />
    </Scene.Node>
  </Scene>
)
