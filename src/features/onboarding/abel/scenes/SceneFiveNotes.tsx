import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import { type ComponentProps, useEffect } from 'react'
import { Pressable, TextInput } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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
import { AbelSourceCard, HevelSourceCard } from './GenesisSourceCard'
import NoteCard from './NoteCard'

const SOURCE_ENTER_START = 220
const SOURCE_STAGGER = 120
const NOTE_TYPING_DELAY = SOURCE_ENTER_START + SOURCE_STAGGER * 2 + 240
const NOTE_TYPING_DURATION = 2400
const CURSOR_BLINK_DURATION = 480
const THIN_CURSOR = '▏'
const SHAKE_ROTATION = 3
const SHAKE_TIMING_CONFIG = {
  duration: 80,
  easing: Easing.bezier(0.35, 0.7, 0.5, 0.7),
}

type SceneFiveElementProps = {
  metrics: OnboardingStageMetrics
  t: TFunction
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)
type AnimatedTextInputAnimatedProps = ComponentProps<typeof AnimatedTextInput>['animatedProps']

type TypewriterTextProps = {
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  text: string
}

const TypewriterText = ({ metrics, reduceMotion, text }: TypewriterTextProps) => {
  const theme = useTheme()
  const progress = useSharedValue(reduceMotion ? 1 : 0)
  const cursorVisibility = useSharedValue(1)
  const revealedText = useDerivedValue(() => {
    const characterCount = Math.round(Math.min(1, Math.max(0, progress.get())) * text.length)
    const cursor = cursorVisibility.get() >= 0.5 ? THIN_CURSOR : ' '

    return `${text.slice(0, characterCount)}${cursor}`
  })
  const animatedProps = useAnimatedProps<{ text: string }>(() => ({
    text: revealedText.get(),
  })) as unknown as AnimatedTextInputAnimatedProps

  useEffect(() => {
    progress.set(reduceMotion ? 1 : 0)
    cursorVisibility.set(1)
    if (!reduceMotion) {
      progress.set(
        withDelay(
          NOTE_TYPING_DELAY,
          withTiming(1, { duration: NOTE_TYPING_DURATION, easing: Easing.linear })
        )
      )
      cursorVisibility.set(
        withRepeat(
          withTiming(0, { duration: CURSOR_BLINK_DURATION, easing: Easing.linear }),
          0,
          true
        )
      )
    }

    return () => {
      cancelAnimation(progress)
      cancelAnimation(cursorVisibility)
    }
  }, [cursorVisibility, progress, reduceMotion, text])

  return (
    <AnimatedTextInput
      animatedProps={animatedProps}
      defaultValue={reduceMotion ? text : ''}
      editable={false}
      multiline
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      style={{
        width: '100%',
        height: metrics.s(77),
        marginTop: metrics.s(13),
        padding: 0,
        color: theme.colors.default,
        fontFamily: 'Courier',
        fontSize: metrics.s(17),
        fontWeight: 'bold',
        lineHeight: metrics.s(19.2),
        textAlignVertical: 'top',
      }}
    />
  )
}

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
  reduceMotion: boolean
}

const QuestionNoteContent = ({
  metrics,
  onAbelPress,
  onGenesisPress,
  onHevelPress,
  reduceMotion,
  t,
}: QuestionNoteProps) => {
  const theme = useTheme()
  const s = metrics.s

  return (
    <>
      <TypewriterText
        metrics={metrics}
        reduceMotion={reduceMotion}
        text={t('onboarding.abel.sceneFive.noteQuestion')}
      />
      <Box width={s(32)} height={s(2)} borderRadius={s(1)} bg="#FF6B6B" mt={s(13)} />
      <HStack mt={s(10)} alignItems="center" gap={s(5)}>
        <Feather name="git-merge" size={s(10)} color={theme.colors.tertiary} />
        <Text color="tertiary" bold fontSize={s(8)} style={{ letterSpacing: s(0.7) }}>
          {t('onboarding.abel.sceneFive.relations')}
        </Text>
      </HStack>
      <HStack mt={s(7)} gap={s(6)}>
        <RelationChip
          label={t('onboarding.abel.sceneFive.genesisChip')}
          metrics={metrics}
          onPress={onGenesisPress}
        />
        <RelationChip label="H1893" metrics={metrics} onPress={onAbelPress} />
        <RelationChip label="H1892" metrics={metrics} onPress={onHevelPress} />
      </HStack>
    </>
  )
}

type CreateSceneFiveNotesProps = SceneFiveElementProps & {
  highlightColor: HighlightColor
  onAddTagPress: () => void
  reduceMotion: boolean
  shakeRotations: {
    abel: SharedValue<number>
    genesis: SharedValue<number>
    hevel: SharedValue<number>
  }
}

export const createSceneFiveNotes = ({
  highlightColor,
  metrics,
  onAddTagPress,
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
        frame={{ x: 189, y: 332, width: 154, height: 94, rotation: 4, zIndex: 3, opacity: 0.6 }}
        draggable
        dragFriction={0.1}
      >
        <HevelSourceCard metrics={metrics} shakeRotation={shakeRotations.hevel} t={t} />
      </Scene.Node>

      <Scene.Node
        id="verse-card"
        layout="scale"
        frame={{
          x: -108,
          y: -37,
          width: 382,
          height: 294,
          scale: 0.38,
          rotation: -6,
          opacity: 0.5,
          zIndex: 4,
        }}
        enterDelay={SOURCE_ENTER_START}
        enterFrom={{ x: 24, y: 24 }}
        exitTo={{ x: 24, y: 24 }}
        draggable
        dragFriction={0.1}
      >
        <VerseCard
          mode="small"
          reduceMotion={reduceMotion}
          highlightColor={highlightColor}
          metrics={metrics}
          shakeRotation={shakeRotations.genesis}
        />
      </Scene.Node>

      <Scene.Node
        id="abel-source"
        frame={{ x: 200, y: 48, width: 140, height: 100, rotation: 5, zIndex: 4, opacity: 0.6 }}
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
        <NoteCard metrics={metrics} t={t}>
          <QuestionNoteContent
            metrics={metrics}
            onAbelPress={() => shake(shakeRotations.abel)}
            onGenesisPress={() => shake(shakeRotations.genesis)}
            onHevelPress={() => shake(shakeRotations.hevel)}
            reduceMotion={reduceMotion}
            t={t}
          />
        </NoteCard>
      </Scene.Node>

      <Scene.Node
        id="abel-tag-new"
        layout="resize"
        frame={{ x: 265, y: 255, width: 42, height: 42, zIndex: 9 }}
        onPress={onAddTagPress}
        pressScale={0.96}
        enterDelay={3800}
        enterFrom={{ scale: 0.5 }}
        exitTo={{ scale: 1.5 }}
        accessibilityLabel={t('onboarding.abel.sceneFive.addTag')}
      >
        <SceneActionButton icon="tag" metrics={metrics} />
      </Scene.Node>

      <SceneDecorativePluses metrics={metrics} reduceMotion={reduceMotion} scene="five" />
    </Scene>
  )
}
