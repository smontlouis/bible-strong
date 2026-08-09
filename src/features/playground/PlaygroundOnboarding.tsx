import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable, useWindowDimensions, View } from 'react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  type EntryExitAnimationFunction,
  EntryOrExitLayoutType,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { OnboardingStage } from './onboarding/OnboardingStage'
import { SceneGraph } from './onboarding/SceneGraph'
import { ONBOARDING_SCENE_COUNT, ONBOARDING_SCENES } from './onboarding/sceneRegistry'
import { type HighlightColor } from './onboarding/VerseCard'
import { createSceneOneVerseHighlight } from './scenes/SceneOneVerseHighlight'
import { createSceneFiveNotes } from './scenes/SceneFiveNotes'
import {
  createSceneFourOccurrences,
  type OccurrenceFilterDirection,
  type OccurrenceFilterId,
} from './scenes/SceneFourOccurrences'
import { createSceneSixRelations } from './scenes/SceneSixRelations'
import { createSceneSevenReturnToVerse, SCENE_SEVEN_REVEAL } from './scenes/SceneSevenReturnToVerse'
import { createSceneThreeStrong, type StrongCardIndex } from './scenes/SceneThreeStrong'
import { createSceneTwoLexique } from './scenes/SceneTwoLexique'

type PlaygroundOnboardingProps = {
  onComplete: () => void
}

const OCCURRENCE_FILTER_ORDER: OccurrenceFilterId[] = ['vanity', 'idol', 'breath']
const SCENE_ONE_PROMPT_KEYS: Record<HighlightColor, string> = {
  color1: 'playground.sceneOne.phrase',
  color2: 'playground.sceneOne.colorPrompt.color2',
  color3: 'playground.sceneOne.colorPrompt.color3',
  color4: 'playground.sceneOne.colorPrompt.color4',
  color5: 'playground.sceneOne.colorPrompt.color5',
}

const createPromptEntering =
  (delay: number): EntryExitAnimationFunction =>
  () => {
    'worklet'

    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateY: 5 }, { scale: 0.98 }],
      },
      animations: {
        opacity: withDelay(delay, withSpring(1)),
        transform: [
          { translateY: withDelay(delay, withSpring(0)) },
          { scale: withDelay(delay, withSpring(1)) },
        ],
      },
    }
  }

const promptEntering = createPromptEntering(200)
const finalPromptEntering = createPromptEntering(SCENE_SEVEN_REVEAL.promptDelay)

const promptExiting: EntryExitAnimationFunction = () => {
  'worklet'

  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateY: 0 }, { scale: 1 }],
    },
    animations: {
      opacity: withSpring(0),
      transform: [{ translateY: withSpring(-5) }, { scale: withSpring(0.98) }],
    },
  }
}

type StrongCarouselPromptProps = {
  carouselProgress: SharedValue<number>
  commonPrompt: string
  properPrompt: string
  reduceMotion: boolean
  entering?: EntryOrExitLayoutType | undefined
  exiting?: EntryOrExitLayoutType | undefined
}

const StrongCarouselPrompt = ({
  carouselProgress,
  commonPrompt,
  properPrompt,
  reduceMotion,
  entering,
  exiting,
}: StrongCarouselPromptProps) => {
  const properPromptStyle = useAnimatedStyle(() => {
    const rawPhase = carouselProgress.get() % 2
    const phase = rawPhase < 0 ? rawPhase + 2 : rawPhase
    const commonWeight = phase <= 1 ? phase : 2 - phase
    const weight = 1 - commonWeight

    if (reduceMotion) return { opacity: weight >= 0.5 ? 1 : 0 }

    const opacity = interpolate(weight, [0, 0.56, 0.76, 1], [0, 0, 1, 1], Extrapolation.CLAMP)

    return {
      opacity,
      transform: [
        { translateY: interpolate(opacity, [0, 1], [-5, 0], Extrapolation.CLAMP) },
        { scale: interpolate(opacity, [0, 1], [0.98, 1], Extrapolation.CLAMP) },
      ],
    }
  })
  const commonPromptStyle = useAnimatedStyle(() => {
    const rawPhase = carouselProgress.get() % 2
    const phase = rawPhase < 0 ? rawPhase + 2 : rawPhase
    const weight = phase <= 1 ? phase : 2 - phase

    if (reduceMotion) return { opacity: weight >= 0.5 ? 1 : 0 }

    const opacity = interpolate(weight, [0, 0.56, 0.76, 1], [0, 0, 1, 1], Extrapolation.CLAMP)

    return {
      opacity,
      transform: [
        { translateY: interpolate(opacity, [0, 1], [5, 0], Extrapolation.CLAMP) },
        { scale: interpolate(opacity, [0, 1], [0.98, 1], Extrapolation.CLAMP) },
      ],
    }
  })

  const renderPrompt = (prompt: string) => (
    <Text
      title
      fontSize={25}
      lineHeight={32}
      textAlign="center"
      style={{ fontFamily: 'Literata Book' }}
    >
      {prompt}
    </Text>
  )

  return (
    <AnimatedBox flex width="100%" position="relative" entering={entering} exiting={exiting}>
      <AnimatedBox absoluteFill center style={properPromptStyle}>
        {renderPrompt(properPrompt)}
      </AnimatedBox>
      <AnimatedBox absoluteFill center style={commonPromptStyle}>
        {renderPrompt(commonPrompt)}
      </AnimatedBox>
    </AnimatedBox>
  )
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const PlaygroundOnboarding = ({ onComplete }: PlaygroundOnboardingProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const [sceneIndex, setSceneIndex] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [activeColor, setActiveColor] = useState<HighlightColor>('color1')
  const [strongCardIndex, setStrongCardIndex] = useState<StrongCardIndex>(0)
  const [occurrenceFilter, setOccurrenceFilter] = useState<OccurrenceFilterId>('vanity')
  const [occurrenceFilterDirection, setOccurrenceFilterDirection] =
    useState<OccurrenceFilterDirection>(1)
  const sceneFiveGenesisRotation = useSharedValue(0)
  const sceneFiveAbelRotation = useSharedValue(0)
  const sceneFiveHevelRotation = useSharedValue(0)
  const navigationDirection = useSharedValue<1 | -1>(1)
  const [sceneViewportHeight, setSceneViewportHeight] = useState<number>()
  const currentScene = ONBOARDING_SCENES[sceneIndex]
  const canGoBack = sceneIndex > 0
  const isFinalScene = currentScene.id === 'scene-seven'
  const sceneProgress = (sceneIndex + 1) / ONBOARDING_SCENE_COUNT
  const progress = isFinishing ? 1 : sceneProgress
  const progressValue = useSharedValue(progress)
  const strongCarouselProgress = useSharedValue<number>(strongCardIndex)
  const backSlotWidth = useSharedValue(canGoBack ? 70 : 0)
  const backOpacity = useSharedValue(canGoBack ? 1 : 0)
  const backScale = useSharedValue(canGoBack ? 1 : 0.25)
  // The storyboard is authored at 390 pt wide with a 350 pt content column.
  // Keep that column centered, but let it shrink on narrower phones.
  const contentWidth = Math.min(350, Math.max(width - 40, 1))
  const progressWidth = Math.min(145, contentWidth * 0.3)
  const promptKey =
    currentScene.id === 'scene-one' ? SCENE_ONE_PROMPT_KEYS[activeColor] : currentScene.promptKey

  useEffect(() => {
    progressValue.set(reduceMotion ? progress : withSpring(progress))
  }, [progress, progressValue, reduceMotion])

  useEffect(() => {
    backSlotWidth.set(reduceMotion ? (canGoBack ? 70 : 0) : withSpring(canGoBack ? 70 : 0))
    backOpacity.set(reduceMotion ? (canGoBack ? 1 : 0) : withSpring(canGoBack ? 1 : 0))
    backScale.set(reduceMotion ? (canGoBack ? 1 : 0.25) : withSpring(canGoBack ? 1 : 0.25))
  }, [backOpacity, backScale, backSlotWidth, canGoBack, reduceMotion])

  useEffect(() => {
    if (!isFinishing) return
    const timeout = setTimeout(onComplete, reduceMotion ? 0 : 620)
    return () => clearTimeout(timeout)
  }, [isFinishing, onComplete, reduceMotion])

  const progressStyle = useAnimatedStyle(() => ({
    width: progressValue.get() * progressWidth,
  }))
  const backSlotStyle = useAnimatedStyle(() => ({
    width: backSlotWidth.get(),
  }))
  const backButtonStyle = useAnimatedStyle(() => ({
    opacity: backOpacity.get(),
  }))

  const finish = () => {
    if (!isFinishing) setIsFinishing(true)
  }

  const advance = () => {
    if (sceneIndex < ONBOARDING_SCENES.length - 1) {
      navigationDirection.set(1)
      setSceneIndex(value => value + 1)
      return
    }

    finish()
  }

  const goBack = () => {
    if (canGoBack) {
      navigationDirection.set(-1)
      setSceneIndex(value => value - 1)
    }
  }

  const changeOccurrenceFilter = (nextFilter: OccurrenceFilterId) => {
    if (nextFilter === occurrenceFilter) return

    const currentIndex = OCCURRENCE_FILTER_ORDER.indexOf(occurrenceFilter)
    const nextIndex = OCCURRENCE_FILTER_ORDER.indexOf(nextFilter)
    setOccurrenceFilterDirection(nextIndex < currentIndex ? -1 : 1)
    setOccurrenceFilter(nextFilter)
  }

  const opacityButton = useSharedValue(1)
  const scaleButton = useSharedValue(1)

  const handlePressIn = () => {
    opacityButton.set(withSpring(0.8))
    scaleButton.set(withSpring(0.96))
  }

  const handlePressOut = () => {
    opacityButton.set(withSpring(1))
    scaleButton.set(withSpring(1))
  }

  return (
    <Box flex bg="lightGrey" pt={insets.top}>
      <Box width={contentWidth} height={28} mt={19} alignSelf="center" position="relative">
        <Box position="absolute" left={0} right={0} top={10} alignItems="center">
          <Box
            width={progressWidth}
            height={6}
            borderRadius={4}
            bg="lightPrimary"
            overflow="visible"
          >
            <Animated.View
              style={[
                { height: 6, borderRadius: 4, backgroundColor: theme.colors.primary },
                progressStyle,
              ]}
            />
          </Box>
        </Box>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('playground.onboarding.skip')}
          onPress={finish}
          hitSlop={10}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 0,
            top: 0,
            opacity: pressed ? 0.62 : 1,
          })}
        >
          <Text color="primary" fontSize={13} bold>
            {t('playground.onboarding.skip')}
          </Text>
        </Pressable>
      </Box>

      <View
        style={{ flex: 1, paddingHorizontal: 12, overflow: 'visible' }}
        onLayout={({ nativeEvent }) => {
          const nextHeight = nativeEvent.layout.height
          setSceneViewportHeight(currentHeight =>
            currentHeight === nextHeight ? currentHeight : nextHeight
          )
        }}
      >
        <AnimatedBox
          key={isFinishing ? 'playground-complete' : 'playground-scenes'}
          flex={1}
          overflow="visible"
          entering={reduceMotion ? undefined : FadeIn.springify()}
          exiting={reduceMotion ? undefined : FadeOut.springify()}
        >
          {isFinishing ? (
            <VStack flex={1} alignItems="center" justifyContent="center" gap={12}>
              <AnimatedBox
                size={72}
                borderRadius={36}
                bg="lightPrimary"
                center
                entering={reduceMotion ? undefined : FadeInDown.springify()}
              >
                <Feather name="check" size={30} color={theme.colors.primary} />
              </AnimatedBox>
              <Text title fontSize={27} textAlign="center">
                {t('playground.onboarding.complete')}
              </Text>
            </VStack>
          ) : (
            <OnboardingStage availableHeight={sceneViewportHeight}>
              {metrics => (
                <SceneGraph
                  activeSceneId={currentScene.id}
                  connectionColor={theme.colors.primary}
                  metrics={metrics}
                  reduceMotion={reduceMotion}
                >
                  {createSceneOneVerseHighlight({
                    metrics,
                    reduceMotion,
                    activeColor,
                    onColorSelect: setActiveColor,
                  })}
                  {createSceneTwoLexique({
                    metrics,
                    reduceMotion,
                    highlightColor: activeColor,
                    onLexiquePress: advance,
                    t,
                  })}
                  {createSceneThreeStrong({
                    activeIndex: strongCardIndex,
                    carouselProgress: strongCarouselProgress,
                    metrics,
                    reduceMotion,
                    highlightColor: activeColor,
                    onIndexChange: setStrongCardIndex,
                    t,
                  })}
                  {createSceneFourOccurrences({
                    activeFilter: occurrenceFilter,
                    filterDirection: occurrenceFilterDirection,
                    highlightColor: activeColor,
                    metrics,
                    onFilterChange: changeOccurrenceFilter,
                    reduceMotion,
                    t,
                  })}
                  {createSceneFiveNotes({
                    highlightColor: activeColor,
                    metrics,
                    reduceMotion,
                    shakeRotations: {
                      abel: sceneFiveAbelRotation,
                      genesis: sceneFiveGenesisRotation,
                      hevel: sceneFiveHevelRotation,
                    },
                    t,
                  })}
                  {createSceneSixRelations({
                    highlightColor: activeColor,
                    metrics,
                    navigationDirection,
                    reduceMotion,
                    shakeRotations: {
                      abel: sceneFiveAbelRotation,
                      hevel: sceneFiveHevelRotation,
                    },
                    t,
                  })}
                  {createSceneSevenReturnToVerse({
                    highlightColor: activeColor,
                    metrics,
                    reduceMotion,
                    t,
                  })}
                </SceneGraph>
              )}
            </OnboardingStage>
          )}
        </AnimatedBox>
      </View>

      <VStack width={contentWidth} alignSelf="center" pb={Math.max(insets.bottom, 24)} gap={20}>
        <Box height={76} center>
          {currentScene.id === 'scene-three' ? (
            <StrongCarouselPrompt
              carouselProgress={strongCarouselProgress}
              properPrompt={t(currentScene.promptKey)}
              commonPrompt={t('playground.sceneThree.commonPhrase')}
              reduceMotion={reduceMotion}
              entering={reduceMotion ? undefined : promptEntering}
              exiting={reduceMotion ? undefined : promptExiting}
            />
          ) : (
            <AnimatedBox
              key={promptKey}
              entering={
                reduceMotion ? undefined : isFinalScene ? finalPromptEntering : promptEntering
              }
              exiting={reduceMotion ? undefined : promptExiting}
            >
              <Text
                title
                fontSize={currentScene.id === 'scene-one' ? 32 : isFinalScene ? 22 : 25}
                lineHeight={currentScene.id === 'scene-one' ? 38 : isFinalScene ? 26 : 32}
                textAlign="center"
                style={{ fontFamily: 'Literata Book' }}
              >
                {t(promptKey)}
              </Text>
            </AnimatedBox>
          )}
        </Box>
        <HStack height={58} alignItems="center">
          <Animated.View
            pointerEvents={canGoBack ? 'auto' : 'none'}
            style={[{ overflow: 'hidden' }, backSlotStyle]}
          >
            <Animated.View style={[{ width: 58, height: 58 }, backButtonStyle]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('playground.onboarding.back')}
                disabled={!canGoBack}
                onPress={goBack}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
              >
                <Box size={58} borderRadius={29} bg="reverse" center lightShadow>
                  <Feather name="arrow-left" size={24} color={theme.colors.primary} />
                </Box>
              </Pressable>
            </Animated.View>
          </Animated.View>

          <Animated.View style={{ flex: 1 }}>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel={t(
                isFinalScene ? 'playground.onboarding.start' : 'playground.onboarding.continue'
              )}
              onPress={advance}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={{ opacity: opacityButton, transform: [{ scale: scaleButton }] }}
            >
              <Box
                bg="primary"
                borderRadius={29}
                height={58}
                center
                lightShadow
                style={{ flexDirection: 'row', gap: 12 }}
              >
                <Text color="reverse" fontSize={17} bold>
                  {t(
                    isFinalScene ? 'playground.onboarding.start' : 'playground.onboarding.continue'
                  )}
                </Text>
                <Feather name="arrow-right" size={23} color={theme.colors.reverse} />
              </Box>
            </AnimatedPressable>
          </Animated.View>
        </HStack>
      </VStack>
    </Box>
  )
}

export default PlaygroundOnboarding
