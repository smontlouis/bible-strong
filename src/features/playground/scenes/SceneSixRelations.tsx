import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'

import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import { Scene } from '../onboarding/SceneGraph'

const RELATION_ENTER_START = 420
const RELATION_STAGGER = 90

type SceneSixElementProps = {
  metrics: OnboardingStageMetrics
  t: TFunction
}

type RelationEntityCardProps = {
  backgroundColor?: string
  borderColor?: string
  detail: React.ReactNode
  detailColor?: string
  markerColor?: string
  markerLeft?: number
  metrics: OnboardingStageMetrics
  title: string
}

const RelationEntityCard = ({
  backgroundColor = '#FFFFFF',
  borderColor = '#DDE7F5',
  detail,
  detailColor = '#6F7B91',
  markerColor,
  markerLeft,
  metrics,
  title,
}: RelationEntityCardProps) => {
  const s = metrics.s

  return (
    <VStack
      flex
      borderRadius={s(14)}
      borderWidth={s(1)}
      px={s(8)}
      py={s(8)}
      gap={s(3)}
      overflow="visible"
      style={{ backgroundColor, borderColor }}
    >
      {markerColor && markerLeft !== undefined ? (
        <Box
          position="absolute"
          left={s(markerLeft - 3.5)}
          bottom={s(-3.5)}
          size={s(7)}
          borderRadius={s(3.5)}
          style={{
            backgroundColor: markerColor,
            boxShadow: `0 0 8px ${markerColor}80`,
          }}
        />
      ) : null}
      <Text bold fontSize={s(11)} lineHeight={s(14)}>
        {title}
      </Text>
      {typeof detail === 'string' ? (
        <Text
          fontSize={s(8)}
          lineHeight={s(11)}
          style={{ color: detailColor, fontFamily: 'Courier' }}
        >
          {detail}
        </Text>
      ) : (
        detail
      )}
    </VStack>
  )
}

type StrongRelationDetailProps = {
  descriptor: string
  hebrew: string
  metrics: OnboardingStageMetrics
}

const StrongRelationDetail = ({ descriptor, hebrew, metrics }: StrongRelationDetailProps) => (
  <HStack alignItems="center" gap={metrics.s(7)}>
    <Text
      color="tertiary"
      fontSize={metrics.s(8)}
      lineHeight={metrics.s(11)}
      style={{ writingDirection: 'rtl' }}
    >
      {hebrew}
    </Text>
    <Text color="tertiary" fontSize={metrics.s(8)} lineHeight={metrics.s(11)}>
      ·
    </Text>
    <Text
      color="tertiary"
      fontSize={metrics.s(8)}
      lineHeight={metrics.s(11)}
      style={{ fontFamily: 'Courier' }}
    >
      {descriptor}
    </Text>
  </HStack>
)

const AbelTag = ({ metrics }: { metrics: OnboardingStageMetrics }) => (
  <HStack
    flex
    bg="primary"
    borderRadius={metrics.s(14)}
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
  reduceMotion: boolean
}

export const createSceneSixRelations = ({
  metrics,
  reduceMotion,
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
      id="genesis-source"
      layout="resize"
      frame={{ x: 48, y: 111, width: 124, height: 60, zIndex: 5 }}
      draggable
      dragFriction={0.1}
    >
      <RelationEntityCard
        detail={t('playground.sceneSix.genesisDetail')}
        metrics={metrics}
        title={t('playground.sceneSix.genesisTitle')}
      />
    </Scene.Node>

    <Scene.Node
      id="abel-source"
      layout="resize"
      frame={{
        x: 48,
        y: 187,
        width: 104,
        height: 50,
        zIndex: 5,
        anchors: { explains: { x: 0.5, y: 1 } },
      }}
      draggable
      dragFriction={0.1}
    >
      <RelationEntityCard
        detail={
          <StrongRelationDetail
            descriptor={t('playground.sceneSix.abelDetail')}
            hebrew="אָבֶל"
            metrics={metrics}
          />
        }
        markerColor="#5983F0"
        markerLeft={52}
        metrics={metrics}
        title="H1893"
      />
    </Scene.Node>

    <Scene.Node
      id="strong-stack"
      layout="resize"
      frame={{
        x: 198,
        y: 137,
        width: 104,
        height: 50,
        zIndex: 5,
        anchors: { mentions: { x: 0.5, y: 1 } },
      }}
      draggable
      dragFriction={0.1}
    >
      <RelationEntityCard
        detail={
          <StrongRelationDetail
            descriptor={t('playground.sceneSix.hevelDetail')}
            hebrew="הֶבֶל"
            metrics={metrics}
          />
        }
        markerColor="#FF7675"
        markerLeft={52}
        metrics={metrics}
        title="H1892"
      />
    </Scene.Node>

    <Scene.Node
      id="ecclesiastes-occurrence"
      frame={{
        x: 131,
        y: 215,
        width: 168,
        height: 52,
        zIndex: 6,
        anchors: { referencedBy: { x: 0.31, y: 1 } },
      }}
      enterDelay={270}
      enterFrom={{ x: 0, y: -20 }}
      exitTo={{ x: 0, y: -20 }}
      draggable
      dragFriction={0.1}
    >
      <RelationEntityCard
        detail={t('playground.sceneSix.ecclesiastesDetail')}
        markerColor="#FF8400"
        markerLeft={52}
        metrics={metrics}
        title={t('playground.sceneSix.ecclesiastesTitle')}
      />
    </Scene.Node>

    <Scene.Node
      id="question-note"
      layout="resize"
      frame={{
        x: 47,
        y: 340,
        width: 96,
        height: 36,
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
      <RelationEntityCard
        backgroundColor="#FFF2E8"
        borderColor="#FF8400"
        detail="Abel"
        detailColor="#B76A00"
        metrics={metrics}
        title={t('playground.sceneSix.noteTitle')}
      />
    </Scene.Node>

    <Scene.Node
      id="study-card"
      frame={{
        x: 220,
        y: 322,
        width: 116,
        height: 50,
        zIndex: 6,
        anchors: { linkedFrom: { x: 0, y: 0.6 } },
      }}
      enterDelay={360}
      enterFrom={{ x: -22, y: 12 }}
      exitTo={{ x: -22, y: 12 }}
      draggable
      dragFriction={0.1}
    >
      <RelationEntityCard
        backgroundColor="#F0F3FF"
        borderColor="#AFC4FF"
        detail={t('playground.sceneSix.studyDetail')}
        detailColor="#5983F0"
        metrics={metrics}
        title={t('playground.sceneSix.studyTitle')}
      />
    </Scene.Node>

    <Scene.Connection
      from={{ node: 'question-note', anchor: 'explains' }}
      to={{ node: 'abel-source', anchor: 'explains' }}
      curve={{ type: 'quadratic', bend: -0.16 }}
      color="#5983F0"
      opacity={0.68}
      width={1.4}
      enterDelay={RELATION_ENTER_START}
    />
    <Scene.Connection
      from={{ node: 'question-note', anchor: 'references' }}
      to={{ node: 'ecclesiastes-occurrence', anchor: 'referencedBy' }}
      curve={{ type: 'quadratic', bend: 0.12 }}
      color="#FF8400"
      opacity={0.72}
      width={1.4}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER}
    />
    <Scene.Connection
      from={{ node: 'question-note', anchor: 'mentions' }}
      to={{ node: 'strong-stack', anchor: 'mentions' }}
      curve={{ type: 'quadratic', bend: -0.16 }}
      color="#FF7675"
      opacity={0.72}
      width={1.4}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 2}
    />
    <Scene.Connection
      from={{ node: 'question-note', anchor: 'linkedTo' }}
      to={{ node: 'study-card', anchor: 'linkedFrom' }}
      curve={{ type: 'quadratic', bend: -0.08 }}
      color="#AFC4FF"
      opacity={0.8}
      width={1.4}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 3}
    />

    <Scene.Node
      id="relation-label-explains"
      frame={{ x: 41, y: 273, width: 62, height: 20, zIndex: 7 }}
      enterDelay={RELATION_ENTER_START}
      enterFrom={{ x: 0, y: 8 }}
      exitTo={{ x: 0, y: 8 }}
      pointerEvents="none"
    >
      <RelationLabel color="#5983F0" label={t('playground.sceneSix.explains')} metrics={metrics} />
    </Scene.Node>
    <Scene.Node
      id="relation-label-references"
      frame={{ x: 119, y: 283, width: 70, height: 20, zIndex: 7 }}
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
      frame={{ x: 204, y: 277, width: 68, height: 20, zIndex: 7 }}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 2}
      enterFrom={{ x: 0, y: 8 }}
      exitTo={{ x: 0, y: 8 }}
      pointerEvents="none"
    >
      <RelationLabel color="#FF7675" label={t('playground.sceneSix.mentions')} metrics={metrics} />
    </Scene.Node>
    <Scene.Node
      id="relation-label-linked"
      frame={{ x: 158, y: 353, width: 48, height: 20, zIndex: 7 }}
      enterDelay={RELATION_ENTER_START + RELATION_STAGGER * 3}
      enterFrom={{ x: 0, y: 8 }}
      exitTo={{ x: 0, y: 8 }}
      pointerEvents="none"
    >
      <RelationLabel color="#5983F0" label={t('playground.sceneSix.linkedTo')} metrics={metrics} />
    </Scene.Node>
  </Scene>
)
