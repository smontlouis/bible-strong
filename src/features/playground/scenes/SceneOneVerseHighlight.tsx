import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import Color from 'color'
import { Pressable } from 'react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import { Scene } from '../onboarding/SceneGraph'
import VerseCard, { HIGHLIGHT_COLORS, type HighlightColor } from '../onboarding/VerseCard'

type SceneOneVerseHighlightProps = {
  reduceMotion: boolean
  metrics: OnboardingStageMetrics
  activeColor: HighlightColor
  onColorSelect: (color: HighlightColor) => void
}

type SceneOneLayerProps = Pick<SceneOneVerseHighlightProps, 'reduceMotion' | 'metrics'>

type ColorSwatchProps = {
  color: string
  label: string
  selected: boolean
  reduceMotion: boolean
  scale: number
  onPress: () => void
}

const ColorSwatch = ({
  color,
  label,
  selected,
  reduceMotion,
  scale,
  onPress,
}: ColorSwatchProps) => {
  const theme = useTheme()
  const selectedProgress = useSharedValue(selected ? 1 : 0)
  const selectedFrameColor = Color(color).alpha(0.12).rgb().string()

  useEffect(() => {
    selectedProgress.set(
      reduceMotion
        ? selected
          ? 1
          : 0
        : withSpring(selected ? 1 : 0, { damping: 15, stiffness: 190 })
    )
  }, [reduceMotion, selected, selectedProgress])

  const frameStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectedProgress.get(),
      [0, 1],
      ['transparent', selectedFrameColor]
    ),
    transform: [{ scale: interpolate(selectedProgress.get(), [0, 1], [1, 1.04]) }],
  }))

  const swatchStyle = useAnimatedStyle(() => ({
    borderColor: theme.colors.reverse,
    borderWidth: interpolate(selectedProgress.get(), [0, 1], [0, 3], Extrapolation.CLAMP),
    shadowColor: color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: interpolate(selectedProgress.get(), [0, 1], [0, 0.36]),
    shadowRadius: 6,
    transform: [{ scale: interpolate(selectedProgress.get(), [0, 1], [1, 0.92]) }],
  }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
    >
      <Animated.View
        style={[
          {
            width: 32 * scale,
            height: 38 * scale,
            borderRadius: 12 * scale,
            alignItems: 'center',
            justifyContent: 'center',
          },
          frameStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: 24 * scale,
              height: 24 * scale,
              borderRadius: 12 * scale,
              backgroundColor: color,
            },
            swatchStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}

export const SceneOneVerseHighlightBackground = ({ reduceMotion, metrics }: SceneOneLayerProps) => {
  const s = metrics.s

  return (
    <Box flex width="100%" overflow="visible">
      <AnimatedBox
        position="absolute"
        width={s(310)}
        height={s(310)}
        borderRadius={s(155)}
        bg="lightPrimary"
        opacity={0.66}
        top={s(56)}
        left={s(-52)}
        entering={reduceMotion ? undefined : FadeIn.duration(720).delay(40)}
      />
      <AnimatedBox
        position="absolute"
        width={s(105)}
        height={s(105)}
        borderRadius={s(52.5)}
        bg="color2"
        bgOpacity="010"
        opacity={0.72}
        top={s(278)}
        left={s(252)}
        entering={reduceMotion ? undefined : FadeIn.duration(600).delay(220)}
      />
      <AnimatedBox
        position="absolute"
        top={s(38)}
        left={s(302)}
        entering={reduceMotion ? undefined : FadeInDown.duration(450).delay(340)}
      >
        <Text color="secondary" fontSize={s(19)} bold>
          +
        </Text>
      </AnimatedBox>
      <AnimatedBox
        position="absolute"
        top={s(342)}
        left={s(8)}
        entering={reduceMotion ? undefined : FadeInUp.duration(450).delay(430)}
      >
        <Text color="primary" fontSize={s(16)} bold>
          +
        </Text>
      </AnimatedBox>
      <AnimatedBox
        position="absolute"
        top={s(390)}
        left={s(326)}
        entering={reduceMotion ? undefined : FadeInUp.duration(450).delay(510)}
      >
        <Text color="secondary" fontSize={s(11)} bold>
          +
        </Text>
      </AnimatedBox>
    </Box>
  )
}

export const SceneOneVerseHighlightControls = ({
  reduceMotion,
  metrics,
  activeColor,
  onColorSelect,
}: SceneOneVerseHighlightProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const [isPaletteOpen, setIsPaletteOpen] = useState(true)
  const fabScale = useSharedValue(1)

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.get() }],
  }))

  const pressIn = () => {
    fabScale.set(reduceMotion ? 0.94 : withSpring(0.94, { damping: 15, stiffness: 240 }))
  }

  const pressOut = () => {
    fabScale.set(reduceMotion ? 1 : withSpring(1, { damping: 14, stiffness: 220 }))
  }

  const s = metrics.s

  return (
    <Box flex width="100%" overflow="visible">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          `playground.sceneOne.togglePalette.${isPaletteOpen ? 'hide' : 'show'}`
        )}
        accessibilityState={{ expanded: isPaletteOpen }}
        onPress={() => setIsPaletteOpen(value => !value)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{
          position: 'absolute',
          top: s(294),
          left: s(282),
          width: s(48),
          height: s(48),
          zIndex: 3,
        }}
      >
        <AnimatedBox style={fabStyle} zIndex={3}>
          <Box
            size={s(48)}
            borderRadius={s(24)}
            bg="primary"
            center
            lightShadow
            transform={[{ rotate: '5deg' }]}
          >
            <Feather name="edit-3" size={s(22)} color={theme.colors.reverse} />
          </Box>
        </AnimatedBox>
      </Pressable>

      {isPaletteOpen ? (
        <AnimatedBox
          key="scene-one-palette"
          position="absolute"
          top={s(326)}
          left={s(137)}
          height={s(58)}
          bg="reverse"
          borderRadius={s(18)}
          px={s(12)}
          py={s(10)}
          lightShadow
          zIndex={2}
          entering={reduceMotion ? undefined : FadeInDown.duration(420).delay(120)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(240)}
        >
          <HStack alignItems="center" gap={s(6)}>
            {HIGHLIGHT_COLORS.map(colorKey => (
              <ColorSwatch
                key={colorKey}
                color={theme.colors[colorKey]}
                label={t(`playground.sceneOne.${colorKey}`)}
                selected={colorKey === activeColor}
                reduceMotion={reduceMotion}
                scale={metrics.scale}
                onPress={() => onColorSelect(colorKey)}
              />
            ))}
          </HStack>
        </AnimatedBox>
      ) : null}
    </Box>
  )
}

const SceneOneVerseHighlight = (props: SceneOneVerseHighlightProps) => (
  <>
    <SceneOneVerseHighlightBackground {...props} />
    <Scene.Layer zIndex={5}>
      <SceneOneVerseHighlightControls {...props} />
    </Scene.Layer>
  </>
)

export const createSceneOneVerseHighlight = (props: SceneOneVerseHighlightProps) => (
  <Scene id="scene-one">
    <SceneOneVerseHighlightBackground metrics={props.metrics} reduceMotion={props.reduceMotion} />
    <Scene.Node
      id="verse-card"
      layout="scale"
      frame={{
        x: -16,
        y: 82,
        width: 382,
        height: 294,
        rotation: -1,
        zIndex: 4,
        anchors: { highlightedWord: { x: 0.43, y: 0.52 } },
      }}
    >
      <VerseCard
        reduceMotion={props.reduceMotion}
        highlightColor={props.activeColor}
        metrics={props.metrics}
      />
    </Scene.Node>
    <SceneOneVerseHighlightControls {...props} />
  </Scene>
)

export default SceneOneVerseHighlight
