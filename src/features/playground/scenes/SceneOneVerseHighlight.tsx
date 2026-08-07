import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { Pressable, useWindowDimensions } from 'react-native'
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
  withTiming,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text, { AnimatedText } from '~common/ui/Text'

const DESIGN_CONTENT_WIDTH = 350
const DESIGN_ILLUSTRATION_HEIGHT = 480
const HIGHLIGHT_COLORS = ['color1', 'color2', 'color3', 'color4', 'color5'] as const
type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

type SceneOneVerseHighlightProps = {
  reduceMotion: boolean
  availableHeight?: number
}

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
  const selectedProgress = useSharedValue(selected ? 1 : 0)

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
      ['transparent', 'rgba(255,240,240,1)']
    ),
    transform: [{ scale: interpolate(selectedProgress.get(), [0, 1], [1, 1.04]) }],
  }))

  const swatchStyle = useAnimatedStyle(() => ({
    borderColor: '#FFFFFF',
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

const SceneOneVerseHighlight = ({ reduceMotion, availableHeight }: SceneOneVerseHighlightProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()
  const [activeColor, setActiveColor] = useState<HighlightColor>('color2')
  const [isPaletteOpen, setIsPaletteOpen] = useState(true)
  const previousHighlightColor = useSharedValue(theme.colors.color2)
  const targetHighlightColor = useSharedValue(theme.colors.color2)
  const highlightProgress = useSharedValue(1)
  const fabScale = useSharedValue(1)

  // The JSON reference is 390×844. Keep its proportions, but scale the complete
  // illustration down on narrower or shorter devices so palette/card never clip.
  const contentWidth = Math.max(width - 40, 1)
  const widthScale = Math.min(1, contentWidth / DESIGN_CONTENT_WIDTH)
  const fallbackHeight = Math.max(height - 250, 1)
  const sceneHeight = availableHeight && availableHeight > 0 ? availableHeight : fallbackHeight
  const heightScale = Math.min(1, sceneHeight / DESIGN_ILLUSTRATION_HEIGHT)
  const scale = Math.max(0.01, Math.min(widthScale, heightScale))
  const s = (value: number) => value * scale
  const illustrationWidth = s(DESIGN_CONTENT_WIDTH)
  const illustrationHeight = s(DESIGN_ILLUSTRATION_HEIGHT)

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlightProgress.get(),
      [0, 1],
      [previousHighlightColor.get(), targetHighlightColor.get()]
    ),
    transform: [{ scale: interpolate(highlightProgress.get(), [0, 1], [0.96, 1]) }],
  }))

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.get() }],
  }))

  const selectColor = (colorKey: HighlightColor) => {
    if (colorKey === activeColor) return

    previousHighlightColor.set(targetHighlightColor.get())
    targetHighlightColor.set(theme.colors[colorKey])
    highlightProgress.set(0)
    highlightProgress.set(reduceMotion ? 1 : withTiming(1, { duration: 420 }))
    setActiveColor(colorKey)
  }

  const pressIn = () => {
    fabScale.set(reduceMotion ? 0.94 : withSpring(0.94, { damping: 15, stiffness: 240 }))
  }

  const pressOut = () => {
    fabScale.set(reduceMotion ? 1 : withSpring(1, { damping: 14, stiffness: 220 }))
  }

  const entering = reduceMotion ? undefined : FadeInDown.duration(680).delay(80)
  const lineEntering = (delay: number) =>
    reduceMotion ? undefined : FadeInUp.duration(520).delay(delay)

  return (
    <Box flex width="100%" alignItems="center" justifyContent="center" overflow="visible">
      <Box
        width={illustrationWidth}
        height={illustrationHeight}
        position="relative"
        overflow="visible"
      >
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
          backgroundColor="rgba(255,118,117,0.13)"
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

        <AnimatedBox
          key="scene-one-verse-card"
          position="absolute"
          top={s(82)}
          left={s(-16)}
          width={s(382)}
          height={s(294)}
          overflow="visible"
          entering={entering}
        >
          <Box
            flex={1}
            bg="reverse"
            borderRadius={s(28)}
            p={s(24)}
            lightShadow
            overflow="visible"
            transform={[{ rotate: '-1deg' }]}
          >
            <HStack alignItems="center" justifyContent="space-between">
              <AnimatedBox entering={lineEntering(120)}>
                <Text
                  title
                  fontSize={s(31)}
                  lineHeight={s(38)}
                  style={{ fontFamily: 'Literata Book' }}
                >
                  {t('playground.sceneOne.chapter')}
                </Text>
              </AnimatedBox>
              <Feather name="plus" size={s(23)} color={theme.colors.primary} />
            </HStack>

            <VStack mt={s(22)} gap={s(3)}>
              <AnimatedBox entering={lineEntering(220)}>
                <Text fontSize={s(23)} lineHeight={s(34)}>
                  {t('playground.sceneOne.lineOne')}
                </Text>
              </AnimatedBox>
              <AnimatedBox entering={lineEntering(300)}>
                <HStack alignItems="center">
                  <AnimatedText
                    fontSize={s(28)}
                    lineHeight={s(42)}
                    style={[{ paddingHorizontal: s(4), borderRadius: s(9) }, highlightStyle]}
                  >
                    {t('playground.sceneOne.highlightWord')}
                  </AnimatedText>
                  <Text fontSize={s(28)} lineHeight={s(42)}>
                    {t('playground.sceneOne.lineTwo')}
                  </Text>
                </HStack>
              </AnimatedBox>
              <AnimatedBox entering={lineEntering(360)}>
                <Text fontSize={s(28)} lineHeight={s(42)}>
                  {t('playground.sceneOne.lineThree')}
                </Text>
              </AnimatedBox>
            </VStack>

            <AnimatedBox mt={s(26)} entering={lineEntering(450)}>
              <Text color="tertiary" fontSize={s(12)} bold style={{ letterSpacing: s(2.4) }}>
                {t('playground.sceneOne.translation')}
              </Text>
            </AnimatedBox>
          </Box>
        </AnimatedBox>

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
                  scale={scale}
                  onPress={() => selectColor(colorKey)}
                />
              ))}
            </HStack>
          </AnimatedBox>
        ) : null}
      </Box>
    </Box>
  )
}

export default SceneOneVerseHighlight
