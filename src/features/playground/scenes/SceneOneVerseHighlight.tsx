import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import Color from 'color'
import { Pressable } from 'react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack } from '~common/ui/Box'
import {
  DESIGN_CONTENT_WIDTH,
  DESIGN_STAGE_HEIGHT,
  type OnboardingStageMetrics,
} from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import SceneDecorativePluses from '../onboarding/SceneDecorativePluses'
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

const paletteEntering = (translateX: number, translateY: number) => () => {
  'worklet'

  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateX }, { translateY }, { scale: 0.62 }],
    },
    animations: {
      opacity: withDelay(120, withSpring(1)),
      transform: [
        { translateX: withDelay(120, withSpring(0)) },
        { translateY: withDelay(120, withSpring(0)) },
        { scale: withDelay(120, withSpring(1)) },
      ],
    },
  }
}

const paletteExiting = (translateX: number, translateY: number) => () => {
  'worklet'

  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
    },
    animations: {
      opacity: withSpring(0),
      transform: [
        { translateX: withSpring(translateX) },
        { translateY: withSpring(translateY) },
        { scale: withSpring(0.62) },
      ],
    },
  }
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
    selectedProgress.set(reduceMotion ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0))
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
        width={s(105)}
        height={s(105)}
        borderRadius={s(52.5)}
        bg="color2"
        bgOpacity="010"
        opacity={0.72}
        top={s(278)}
        left={s(252)}
        entering={reduceMotion ? undefined : FadeIn.springify().delay(220)}
      />
      <SceneDecorativePluses metrics={metrics} reduceMotion={reduceMotion} scene="one" />
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
    fabScale.set(reduceMotion ? 0.96 : withSpring(0.96))
  }

  const pressOut = () => {
    fabScale.set(reduceMotion ? 1 : withSpring(1))
  }

  const s = metrics.s
  const paletteTranslateX = s(30)
  const paletteTranslateY = s(-30)

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
        <AnimatedBox style={fabStyle} zIndex={3} overflow="visible">
          <Box
            size={s(48)}
            borderRadius={s(24)}
            bg="primary"
            center
            transform={[{ rotate: '5deg' }]}
            style={{
              boxShadow: '0 4px 6px rgba(89,131,240, 0.5)',
            }}
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
          entering={
            reduceMotion ? undefined : paletteEntering(paletteTranslateX, paletteTranslateY)
          }
          exiting={reduceMotion ? undefined : paletteExiting(paletteTranslateX, paletteTranslateY)}
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
    <SceneOneVerseHighlightControls {...props} />
  </>
)

export const createSceneOneVerseHighlight = (props: SceneOneVerseHighlightProps) => (
  <Scene id="scene-one">
    <SceneOneVerseHighlightBackground metrics={props.metrics} reduceMotion={props.reduceMotion} />
    <Scene.Node
      id="scene-background"
      layout="resize"
      frame={{ x: -52, y: 56, width: 310, height: 310, opacity: 0.66, zIndex: 0 }}
      pointerEvents="none"
    >
      <SceneBackgroundShape borderRadius={props.metrics.s(155)} reduceMotion={props.reduceMotion} />
    </Scene.Node>
    <Scene.Node
      id="verse-card"
      layout="scale"
      frame={{
        x: -16,
        y: 82,
        width: 382,
        height: 294,
        rotation: -1,
        zIndex: 5,
        anchors: { highlightedWord: { x: 0.43, y: 0.52 } },
      }}
      draggable
      dragFriction={0.1}
    >
      <VerseCard
        reduceMotion={props.reduceMotion}
        highlightColor={props.activeColor}
        metrics={props.metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="highlight-controls"
      layout="position"
      pointerEvents="box-none"
      frame={{
        x: 0,
        y: 0,
        width: DESIGN_CONTENT_WIDTH,
        height: DESIGN_STAGE_HEIGHT,
        zIndex: 5,
      }}
    >
      <SceneOneVerseHighlightControls {...props} />
    </Scene.Node>
  </Scene>
)

export default SceneOneVerseHighlight
