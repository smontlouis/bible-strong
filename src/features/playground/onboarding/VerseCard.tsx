import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Color from 'color'
import {
  type EntryExitAnimationFunction,
  FadeInUp,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import { AnimatedText } from '~common/ui/Text'
import { getContrastTextColor } from '~helpers/highlightUtils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { OnboardingStageMetrics } from './OnboardingStage'

export const HIGHLIGHT_COLORS = ['color1', 'color2', 'color3', 'color4', 'color5'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export type ResourceIllustration =
  | 'comments'
  | 'comparisons'
  | 'dictionary'
  | 'references'
  | 'themes'

type ResourceIllustrationLayout = {
  x: number
  y: number
  size: number
}

const RESOURCE_ILLUSTRATION_LAYOUTS = {
  comments: { x: 90, y: 140, size: 235 },
  comparisons: { x: 107, y: 111, size: 290 },
  dictionary: { x: 100, y: 120, size: 250 },
  references: { x: 132, y: 100, size: 260 },
  themes: { x: 100, y: 100, size: 250 },
} satisfies Record<ResourceIllustration, ResourceIllustrationLayout>

type VerseCardProps = {
  reduceMotion: boolean
  highlightColor: HighlightColor
  metrics: OnboardingStageMetrics
  mode?: 'small' | 'normal'
  shakeRotation?: SharedValue<number>
  highlightOverrideColor?: string
  resourceIllustration?: ResourceIllustration
}

const lineEntering = (delay: number, reduceMotion: boolean) =>
  reduceMotion ? undefined : FadeInUp.springify().delay(delay)

const commentsIllustrationEntering: EntryExitAnimationFunction = () => {
  'worklet'

  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateX: 300 }],
    },
    animations: {
      opacity: 1,
      transform: [{ translateX: withSpring(0) }],
    },
  }
}

const commentsIllustrationExiting: EntryExitAnimationFunction = () => {
  'worklet'

  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateX: 0 }],
    },
    animations: {
      opacity: 1,
      transform: [{ translateX: withSpring(300) }],
    },
  }
}

const VerseCard = ({
  reduceMotion,
  highlightColor,
  metrics,
  mode,
  shakeRotation,
  highlightOverrideColor,
  resourceIllustration,
}: VerseCardProps) => {
  const theme = useTheme()
  const { colorScheme } = useCurrentThemeSelector()
  const { i18n, t } = useTranslation()
  const s = metrics.s
  const isEnglish = i18n.language.startsWith('en')
  const verseFontSize = s(isEnglish ? 20 : 23)
  const verseLineHeight = s(isEnglish ? 29 : 34)
  const highlightBackgroundColor = highlightOverrideColor ?? theme.colors[highlightColor]
  const highlightTextColor = getContrastTextColor(
    Color(highlightBackgroundColor).hex(),
    colorScheme === 'dark'
  )
  const targetHighlightColor = useSharedValue(highlightBackgroundColor)
  const highlightProgress = useSharedValue(1)
  const resourceIllustrationLayout = resourceIllustration
    ? RESOURCE_ILLUSTRATION_LAYOUTS[resourceIllustration]
    : undefined
  const dimmedTextStyle = {
    opacity: resourceIllustration ? 0.22 : 1,
    transitionProperty: 'opacity' as const,
    transitionDuration: reduceMotion ? 0 : 280,
    transitionTimingFunction: 'ease-in-out' as const,
  }

  useEffect(() => {
    targetHighlightColor.set(highlightBackgroundColor)
    highlightProgress.set(0)
    highlightProgress.set(reduceMotion ? 1 : withSpring(1))
  }, [highlightBackgroundColor, reduceMotion, targetHighlightColor, highlightProgress])

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: targetHighlightColor.get(),
    transform: [{ scale: interpolate(highlightProgress.get(), [0, 1], [1.05, 1]) }],
  }))
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shakeRotation?.get() ?? 0}deg` }],
  }))

  return (
    <AnimatedBox flex style={shakeStyle}>
      <Box flex={1} bg="reverse" borderRadius={s(28)} p={s(24)} lightShadow overflow="visible">
        <HStack alignItems="center">
          <AnimatedBox entering={lineEntering(120, reduceMotion)}>
            <AnimatedText
              title
              color="primary"
              fontSize={s(31)}
              lineHeight={s(38)}
              style={[{ fontFamily: 'Literata Book' }, dimmedTextStyle]}
            >
              {t('playground.sceneOne.chapter')}
            </AnimatedText>
          </AnimatedBox>
        </HStack>

        <VStack mt={s(22)} gap={s(3)}>
          <AnimatedBox entering={lineEntering(220, reduceMotion)}>
            <AnimatedText
              fontSize={verseFontSize}
              lineHeight={verseLineHeight}
              style={dimmedTextStyle}
            >
              {t('playground.sceneOne.lineOne')}
            </AnimatedText>
          </AnimatedBox>
          <AnimatedBox entering={lineEntering(300, reduceMotion)}>
            <HStack alignItems="center">
              <AnimatedText
                fontSize={verseFontSize}
                lineHeight={verseLineHeight}
                style={[
                  {
                    paddingHorizontal: s(4),
                    borderRadius: s(9),
                    backgroundColor: highlightBackgroundColor,
                    color: highlightTextColor,
                  },
                  highlightStyle,
                ]}
              >
                {t('playground.sceneOne.highlightWord')}
              </AnimatedText>
              <AnimatedText
                fontSize={verseFontSize}
                lineHeight={verseLineHeight}
                style={dimmedTextStyle}
              >
                {t('playground.sceneOne.lineTwo')}
              </AnimatedText>
            </HStack>
          </AnimatedBox>
          <AnimatedBox entering={lineEntering(360, reduceMotion)}>
            <AnimatedText
              fontSize={verseFontSize}
              lineHeight={verseLineHeight}
              style={dimmedTextStyle}
            >
              {t('playground.sceneOne.lineThree')}
            </AnimatedText>
          </AnimatedBox>
        </VStack>

        <AnimatedBox mt={s(26)} entering={lineEntering(450, reduceMotion)}>
          <AnimatedText
            color="tertiary"
            fontSize={s(12)}
            bold
            style={[{ letterSpacing: s(2.4) }, dimmedTextStyle]}
          >
            {t('playground.sceneOne.translation')}
          </AnimatedText>
        </AnimatedBox>

        {resourceIllustration && resourceIllustrationLayout ? (
          <AnimatedBox
            key={resourceIllustration}
            pointerEvents="none"
            position="absolute"
            left={s(resourceIllustrationLayout.x)}
            top={s(resourceIllustrationLayout.y)}
            size={s(resourceIllustrationLayout.size)}
            overflow="hidden"
            entering={reduceMotion ? undefined : commentsIllustrationEntering}
            exiting={reduceMotion ? undefined : commentsIllustrationExiting}
            style={{ zIndex: 5 }}
          >
            <Image
              source={
                resourceIllustration === 'dictionary'
                  ? require('../../../assets/images/onboarding/dictionary-proposal-2.png')
                  : resourceIllustration === 'comparisons'
                    ? require('../../../assets/images/onboarding/comparisons-proposal-3.png')
                    : resourceIllustration === 'references'
                      ? require('../../../assets/images/onboarding/references-proposal-2.png')
                      : resourceIllustration === 'themes'
                        ? require('../../../assets/images/onboarding/themes-proposal-3.png')
                        : require('../../../assets/images/onboarding/comments-theologians.png')
              }
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          </AnimatedBox>
        ) : null}
      </Box>
    </AnimatedBox>
  )
}

export default VerseCard
