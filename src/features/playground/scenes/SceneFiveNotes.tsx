import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import { Pressable } from 'react-native'
import {
  Easing,
  FadeInUp,
  type SharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import { Scene } from '../onboarding/SceneGraph'

const SOURCE_ENTER_START = 220
const SOURCE_STAGGER = 120
const SHAKE_ROTATION = 3
const SHAKE_TIMING_CONFIG = {
  duration: 80,
  easing: Easing.bezier(0.35, 0.7, 0.5, 0.7),
}

type SceneFiveElementProps = {
  metrics: OnboardingStageMetrics
  t: TFunction
}

type SourceCardProps = SceneFiveElementProps & {
  label: string
  markerColor: string
  meta?: string
  title: string
  titleItalic?: boolean
  shakeRotation: SharedValue<number>
}

const SourceCard = ({
  label,
  markerColor,
  meta,
  metrics,
  shakeRotation,
  title,
  titleItalic = false,
}: SourceCardProps) => {
  const s = metrics.s
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shakeRotation.get()}deg` }],
  }))

  return (
    <AnimatedBox flex overflow="visible" style={shakeStyle}>
      <VStack
        flex
        bg="reverse"
        borderRadius={s(16)}
        px={s(11)}
        py={s(10)}
        gap={s(5)}
        style={{ boxShadow: '0 4px 12px rgba(59,92,204,0.13)' }}
      >
        <HStack justifyContent="space-between" alignItems="center">
          <Text color="primary" bold fontSize={s(8)} style={{ letterSpacing: s(0.6) }}>
            {label}
          </Text>
          <Box size={s(7)} borderRadius={s(3.5)} style={{ backgroundColor: markerColor }} />
        </HStack>
        <Text
          title
          fontSize={s(20)}
          lineHeight={s(23)}
          bold={!titleItalic}
          style={{
            fontFamily: 'Literata Book',
            fontStyle: titleItalic ? 'italic' : 'normal',
          }}
        >
          {title}
        </Text>
        {meta ? (
          <Text color="tertiary" bold fontSize={s(9.5)} lineHeight={s(12)}>
            {meta}
          </Text>
        ) : null}
      </VStack>
    </AnimatedBox>
  )
}

type ShakableSourceCardProps = SceneFiveElementProps & {
  shakeRotation: SharedValue<number>
}

const GenesisSourceCard = ({ metrics, shakeRotation, t }: ShakableSourceCardProps) => (
  <SourceCard
    label={t('playground.sceneFive.genesisLabel')}
    markerColor="#5983F0"
    metrics={metrics}
    shakeRotation={shakeRotation}
    t={t}
    title={t('playground.sceneFive.genesisTitle')}
  />
)

const AbelSourceCard = ({ metrics, shakeRotation, t }: ShakableSourceCardProps) => (
  <SourceCard
    label={t('playground.sceneFive.abelLabel')}
    markerColor="#FF6B6B"
    meta={t('playground.sceneFive.abelMeta')}
    metrics={metrics}
    shakeRotation={shakeRotation}
    t={t}
    title="Abel"
  />
)

const HevelSourceCard = ({ metrics, shakeRotation, t }: ShakableSourceCardProps) => (
  <SourceCard
    label={t('playground.sceneFive.hevelLabel')}
    markerColor="#FDCB6E"
    meta={t('playground.sceneFive.hevelMeta')}
    metrics={metrics}
    shakeRotation={shakeRotation}
    t={t}
    title="hevel"
    titleItalic
  />
)

type RelationChipProps = {
  label: string
  metrics: OnboardingStageMetrics
  onPress: () => void
}

const RelationChip = ({ label, metrics, onPress }: RelationChipProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
  >
    <Box
      height={metrics.s(20)}
      borderRadius={metrics.s(10)}
      px={metrics.s(11)}
      center
      style={{ backgroundColor: '#E9F3FC' }}
    >
      <Text color="primary" bold fontSize={metrics.s(8.5)}>
        {label}
      </Text>
    </Box>
  </Pressable>
)

type QuestionNoteProps = SceneFiveElementProps & {
  onAbelPress: () => void
  onGenesisPress: () => void
  onHevelPress: () => void
}

const QuestionNote = ({
  metrics,
  onAbelPress,
  onGenesisPress,
  onHevelPress,
  t,
}: QuestionNoteProps) => {
  const theme = useTheme()
  const s = metrics.s

  return (
    <VStack
      flex
      borderRadius={s(12)}
      px={s(18)}
      pt={s(17)}
      pb={s(14)}
      overflow="visible"
      style={{
        backgroundColor: '#FFF8E8',
        boxShadow: '0 7px 16px rgba(59,92,204,0.15)',
      }}
    >
      <Box
        position="absolute"
        left={s(46)}
        top={s(-7)}
        width={s(96)}
        height={s(14)}
        borderRadius={s(3)}
        style={{ backgroundColor: 'rgba(253,203,110,0.62)', transform: [{ rotate: '2deg' }] }}
      />
      <HStack justifyContent="space-between" alignItems="center">
        <HStack alignItems="center" gap={s(5)}>
          <Feather name="file-plus" size={s(11)} color={theme.colors.quart} />
          <Text color="quart" bold fontSize={s(8.5)} style={{ letterSpacing: s(1) }}>
            {t('playground.sceneFive.noteLabel')}
          </Text>
        </HStack>
        <Text color="#FF6B6B" fontSize={s(14)}>
          ✦
        </Text>
      </HStack>
      <Text fontSize={s(17)} lineHeight={s(19.2)} bold mt={s(13)} style={{ fontFamily: 'Courier' }}>
        {t('playground.sceneFive.noteQuestion')}
      </Text>
      <Box width={s(32)} height={s(2)} borderRadius={s(1)} bg="#FF6B6B" mt={s(13)} />
      <HStack mt={s(10)} alignItems="center" gap={s(5)}>
        <Feather name="git-merge" size={s(10)} color={theme.colors.tertiary} />
        <Text color="tertiary" bold fontSize={s(8)} style={{ letterSpacing: s(0.7) }}>
          {t('playground.sceneFive.relations')}
        </Text>
      </HStack>
      <HStack mt={s(7)} gap={s(6)}>
        <RelationChip
          label={t('playground.sceneFive.genesisChip')}
          metrics={metrics}
          onPress={onGenesisPress}
        />
        <RelationChip label="H1893" metrics={metrics} onPress={onAbelPress} />
        <RelationChip label="H1892" metrics={metrics} onPress={onHevelPress} />
      </HStack>
    </VStack>
  )
}

type CreateSceneFiveNotesProps = SceneFiveElementProps & {
  reduceMotion: boolean
  shakeRotations: {
    abel: SharedValue<number>
    genesis: SharedValue<number>
    hevel: SharedValue<number>
  }
}

export const createSceneFiveNotes = ({
  metrics,
  reduceMotion,
  shakeRotations,
  t,
}: CreateSceneFiveNotesProps) => {
  const shake = (rotation: SharedValue<number>) => {
    if (reduceMotion) return
    rotation.set(
      withSequence(
        withTiming(SHAKE_ROTATION, SHAKE_TIMING_CONFIG),
        withRepeat(withTiming(-SHAKE_ROTATION, SHAKE_TIMING_CONFIG), 3, true),
        withSpring(0, { mass: 0.5 })
      )
    )
  }

  return (
    <Scene id="scene-five">
      <Scene.Node
        id="scene-background"
        layout="resize"
        frame={{ x: 10, y: 0, width: 330, height: 320, opacity: 0.72, zIndex: 0 }}
        pointerEvents="none"
      >
        <SceneBackgroundShape borderRadius={metrics.s(165)} reduceMotion={reduceMotion} />
      </Scene.Node>

      <Scene.Node
        id="strong-stack"
        layout="resize"
        frame={{ x: 189, y: 332, width: 154, height: 94, rotation: 4, zIndex: 3 }}
        draggable
        dragFriction={0.1}
      >
        <HevelSourceCard metrics={metrics} shakeRotation={shakeRotations.hevel} t={t} />
      </Scene.Node>

      <Scene.Node
        id="genesis-source"
        frame={{ x: 11, y: 54, width: 150, height: 98, rotation: -6, zIndex: 4 }}
        enterDelay={SOURCE_ENTER_START}
        enterFrom={{ x: 24, y: 24 }}
        exitTo={{ x: 24, y: 24 }}
        draggable
        dragFriction={0.1}
      >
        <GenesisSourceCard metrics={metrics} shakeRotation={shakeRotations.genesis} t={t} />
      </Scene.Node>

      <Scene.Node
        id="abel-source"
        frame={{ x: 200, y: 48, width: 140, height: 100, rotation: 5, zIndex: 4 }}
        enterDelay={SOURCE_ENTER_START + SOURCE_STAGGER}
        enterFrom={{ x: -24, y: 24 }}
        exitTo={{ x: -24, y: 24 }}
        draggable
        dragFriction={0.1}
      >
        <AbelSourceCard metrics={metrics} shakeRotation={shakeRotations.abel} t={t} />
      </Scene.Node>

      <Scene.Node
        id="question-note"
        frame={{ x: 47, y: 148, width: 246, height: 194, rotation: -2, zIndex: 8 }}
        enterDelay={SOURCE_ENTER_START + SOURCE_STAGGER * 2}
        enterFrom={{ x: 0, y: 28 }}
        exitTo={{ x: 0, y: 28 }}
        draggable
        dragFriction={0.1}
      >
        <QuestionNote
          metrics={metrics}
          onAbelPress={() => shake(shakeRotations.abel)}
          onGenesisPress={() => shake(shakeRotations.genesis)}
          onHevelPress={() => shake(shakeRotations.hevel)}
          t={t}
        />
      </Scene.Node>

      <AnimatedBox
        position="absolute"
        left={metrics.s(16)}
        top={metrics.s(306)}
        entering={reduceMotion ? undefined : FadeInUp.springify().delay(520)}
      >
        <Text color="primary" bold fontSize={metrics.s(18)}>
          +
        </Text>
      </AnimatedBox>
      <AnimatedBox
        position="absolute"
        left={metrics.s(322)}
        top={metrics.s(334)}
        entering={reduceMotion ? undefined : FadeInUp.springify().delay(640)}
      >
        <Text color="primary" bold fontSize={metrics.s(14)}>
          +
        </Text>
      </AnimatedBox>
    </Scene>
  )
}
