import { useTheme } from '@emotion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FadeInUp,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text, { AnimatedText } from '~common/ui/Text'
import type { OnboardingStageMetrics } from './OnboardingStage'

export const HIGHLIGHT_COLORS = ['color1', 'color2', 'color3', 'color4', 'color5'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

type VerseCardProps = {
  reduceMotion: boolean
  highlightColor: HighlightColor
  metrics: OnboardingStageMetrics
}

const lineEntering = (delay: number, reduceMotion: boolean) =>
  reduceMotion ? undefined : FadeInUp.springify().delay(delay)

const VerseCard = ({ reduceMotion, highlightColor, metrics }: VerseCardProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const s = metrics.s
  const previousHighlightColor = useSharedValue(theme.colors.color1)
  const targetHighlightColor = useSharedValue(theme.colors.color1)
  const highlightProgress = useSharedValue(1)

  useEffect(() => {
    const nextColor = theme.colors[highlightColor]
    previousHighlightColor.set(targetHighlightColor.get())
    targetHighlightColor.set(nextColor)
    highlightProgress.set(0)
    highlightProgress.set(reduceMotion ? 1 : withSpring(1))
  }, [
    highlightColor,
    reduceMotion,
    theme.colors,
    previousHighlightColor,
    targetHighlightColor,
    highlightProgress,
  ])

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlightProgress.get(),
      [0, 1],
      [previousHighlightColor.get(), targetHighlightColor.get()]
    ),
    transform: [{ scale: interpolate(highlightProgress.get(), [0, 1], [0.96, 1]) }],
  }))

  return (
    <Box flex={1} bg="reverse" borderRadius={s(28)} p={s(24)} lightShadow overflow="visible">
      <HStack alignItems="center">
        <AnimatedBox entering={lineEntering(120, reduceMotion)}>
          <Text title fontSize={s(31)} lineHeight={s(38)} style={{ fontFamily: 'Literata Book' }}>
            {t('playground.sceneOne.chapter')}
          </Text>
        </AnimatedBox>
      </HStack>

      <VStack mt={s(22)} gap={s(3)}>
        <AnimatedBox entering={lineEntering(220, reduceMotion)}>
          <Text fontSize={s(23)} lineHeight={s(34)}>
            {t('playground.sceneOne.lineOne')}
          </Text>
        </AnimatedBox>
        <AnimatedBox entering={lineEntering(300, reduceMotion)}>
          <HStack alignItems="center">
            <AnimatedText
              fontSize={s(23)}
              lineHeight={s(34)}
              style={[{ paddingHorizontal: s(4), borderRadius: s(9) }, highlightStyle]}
            >
              {t('playground.sceneOne.highlightWord')}
            </AnimatedText>
            <Text fontSize={s(23)} lineHeight={s(34)}>
              {t('playground.sceneOne.lineTwo')}
            </Text>
          </HStack>
        </AnimatedBox>
        <AnimatedBox entering={lineEntering(360, reduceMotion)}>
          <Text fontSize={s(23)} lineHeight={s(34)}>
            {t('playground.sceneOne.lineThree')}
          </Text>
        </AnimatedBox>
      </VStack>

      <AnimatedBox mt={s(26)} entering={lineEntering(450, reduceMotion)}>
        <Text color="tertiary" fontSize={s(12)} bold style={{ letterSpacing: s(2.4) }}>
          {t('playground.sceneOne.translation')}
        </Text>
      </AnimatedBox>
    </Box>
  )
}

export default VerseCard
