import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Alert, Pressable, useWindowDimensions } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  cubicBezier,
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
import { OnboardingStage } from './abel/OnboardingStage'
import { SceneGraph } from './abel/SceneGraph'
import { ONBOARDING_SCENE_COUNT, ONBOARDING_SCENES } from './abel/sceneRegistry'
import { type HighlightColor, type ResourceIllustration } from './abel/VerseCard'
import { createSceneOneVerseHighlight } from './abel/scenes/SceneOneVerseHighlight'
import { createSceneFiveNotes } from './abel/scenes/SceneFiveNotes'
import {
  createSceneFourOccurrences,
  type OccurrenceFilterDirection,
  type OccurrenceFilterId,
} from './abel/scenes/SceneFourOccurrences'
import { createSceneSixRelations } from './abel/scenes/SceneSixRelations'
import {
  createSceneSevenReturnToVerse,
  SCENE_SEVEN_REVEAL,
} from './abel/scenes/SceneSevenReturnToVerse'
import { createSceneThreeStrong, type StrongCardIndex } from './abel/scenes/SceneThreeStrong'
import { createSceneTwoLexique, getSceneTwoNodeColor } from './abel/scenes/SceneTwoLexique'

type AbelOnboardingProps = {
  completionMode?: 'confirmation' | 'handoff'
  onComplete: () => void
}

const OCCURRENCE_FILTER_ORDER: OccurrenceFilterId[] = ['vanity', 'idol', 'breath']
const SCENE_ONE_PROMPT_KEYS: Record<HighlightColor, string> = {
  color1: 'onboarding.abel.sceneOne.phrase',
  color2: 'onboarding.abel.sceneOne.colorPrompt.color2',
  color3: 'onboarding.abel.sceneOne.colorPrompt.color3',
  color4: 'onboarding.abel.sceneOne.colorPrompt.color4',
  color5: 'onboarding.abel.sceneOne.colorPrompt.color5',
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

const promptEntering = createPromptEntering(400)
const finalPromptEntering = createPromptEntering(SCENE_SEVEN_REVEAL.promptDelay)
const finalActionLabelEntering = FadeIn.delay(180).springify()

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

const AbelOnboarding = ({ completionMode = 'handoff', onComplete }: AbelOnboardingProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const [sceneIndex, setSceneIndex] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isFinalActionReady, setIsFinalActionReady] = useState(false)
  const [delayProgressAfterFinalBack, setDelayProgressAfterFinalBack] = useState(false)
  const progressDelayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeColor, setActiveColor] = useState<HighlightColor>('color1')
  const [sceneTwoIllustration, setSceneTwoIllustration] = useState<ResourceIllustration>()
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
  const strongCarouselProgress = useSharedValue<number>(strongCardIndex)
  const backOpacity = useSharedValue(canGoBack ? 1 : 0)
  const backScale = useSharedValue(canGoBack ? 1 : 0.25)
  // The storyboard is authored at 390 pt wide with a 350 pt content column.
  // Keep that column centered, but let it shrink on narrower phones.
  const contentWidth = Math.min(350, Math.max(width - 40, 1))
  const compactProgressWidth = Math.min(145, contentWidth * 0.3)
  const compactHorizontalInset = (contentWidth - compactProgressWidth) / 2
  const compactVerticalInset = (58 - 6) / 2
  const showFinalAction = isFinalScene && isFinalActionReady
  const promptKey =
    currentScene.id === 'scene-one' ? SCENE_ONE_PROMPT_KEYS[activeColor] : currentScene.promptKey

  useEffect(() => {
    backOpacity.set(reduceMotion ? (canGoBack ? 1 : 0) : withSpring(canGoBack ? 1 : 0))
    backScale.set(reduceMotion ? (canGoBack ? 1 : 0.25) : withSpring(canGoBack ? 1 : 0.25))
  }, [backOpacity, backScale, canGoBack, reduceMotion])

  useEffect(() => {
    if (!isFinishing) return
    const completionDelay = completionMode === 'handoff' ? 240 : 620
    const timeout = setTimeout(onComplete, reduceMotion ? 0 : completionDelay)
    return () => clearTimeout(timeout)
  }, [completionMode, isFinishing, onComplete, reduceMotion])

  useEffect(() => {
    if (!isFinalScene) return

    const timeout = setTimeout(
      () => setIsFinalActionReady(true),
      reduceMotion ? 0 : SCENE_SEVEN_REVEAL.actionDelay
    )
    return () => clearTimeout(timeout)
  }, [isFinalScene, reduceMotion])

  useEffect(
    () => () => {
      if (progressDelayTimeout.current) clearTimeout(progressDelayTimeout.current)
    },
    []
  )

  const backButtonStyle = useAnimatedStyle(() => ({
    opacity: backOpacity.get(),
    transform: [{ scale: backScale.get() }],
  }))

  const finish = () => {
    if (!isFinishing) setIsFinishing(true)
  }

  const confirmSkip = () => {
    Alert.alert(t('onboarding.abel.skipConfirmTitle'), t('onboarding.abel.skipConfirmMessage'), [
      {
        text: t('onboarding.abel.keepDiscovering'),
        style: 'cancel',
      },
      {
        text: t('onboarding.abel.skip'),
        onPress: finish,
      },
    ])
  }

  const advance = () => {
    if (progressDelayTimeout.current) clearTimeout(progressDelayTimeout.current)
    setDelayProgressAfterFinalBack(false)
    if (sceneIndex < ONBOARDING_SCENES.length - 1) {
      if (sceneIndex === ONBOARDING_SCENES.length - 2) setIsFinalActionReady(false)
      navigationDirection.set(1)
      setSceneIndex(value => value + 1)
      return
    }

    finish()
  }

  const goBack = () => {
    if (canGoBack) {
      if (progressDelayTimeout.current) clearTimeout(progressDelayTimeout.current)
      setDelayProgressAfterFinalBack(isFinalScene)
      if (isFinalScene) {
        progressDelayTimeout.current = setTimeout(() => setDelayProgressAfterFinalBack(false), 1000)
      }
      setIsFinalActionReady(false)
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

  const handleBackPressIn = () => {
    backScale.set(reduceMotion ? 0.96 : withSpring(0.96))
  }

  const handleBackPressOut = () => {
    backScale.set(reduceMotion ? 1 : withSpring(1))
  }

  return (
    <AnimatedBox
      flex
      bg="lightGrey"
      pt={insets.top}
      pointerEvents={isFinishing ? 'none' : 'auto'}
      style={{
        opacity: isFinishing && completionMode === 'handoff' ? 0 : 1,
        transitionProperty: 'opacity',
        transitionDuration: reduceMotion ? 0 : 240,
        transitionTimingFunction: 'ease-out',
      }}
    >
      <AnimatedPressable
        pointerEvents={canGoBack ? 'auto' : 'none'}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.abel.back')}
        disabled={!canGoBack}
        onPress={goBack}
        onPressIn={handleBackPressIn}
        onPressOut={handleBackPressOut}
        style={[
          {
            position: 'absolute',
            left: Math.max((width - contentWidth) / 2, 20),
            top: insets.top + 9,
            width: 44,
            height: 44,
            zIndex: 1100,
            borderRadius: 22,
            backgroundColor: theme.colors.reverse,
            boxShadow: '0 4px 10px rgba(40,67,128,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          },
          backButtonStyle,
        ]}
      >
        <Feather name="arrow-left" size={21} color={theme.colors.primary} />
      </AnimatedPressable>

      <Box
        width={contentWidth}
        height={28}
        mt={19}
        alignSelf="center"
        position="relative"
        style={{ zIndex: 1000 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.abel.skip')}
          onPress={confirmSkip}
          hitSlop={10}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 10,
            opacity: pressed ? 0.62 : 1,
          })}
        >
          <Text color="tertiary" fontSize={13}>
            {t('onboarding.abel.skip')}
          </Text>
        </Pressable>
      </Box>

      <Box
        flex
        px={12}
        overflow="visible"
        onLayout={({ nativeEvent }) => {
          const nextHeight = nativeEvent.layout.height
          setSceneViewportHeight(currentHeight =>
            currentHeight === nextHeight ? currentHeight : nextHeight
          )
        }}
      >
        <AnimatedBox
          key={isFinishing && completionMode === 'confirmation' ? 'confirmation' : 'scenes'}
          flex={1}
          overflow="visible"
          entering={reduceMotion ? undefined : FadeIn.springify()}
          exiting={reduceMotion ? undefined : FadeOut.springify()}
        >
          {isFinishing && completionMode === 'confirmation' ? (
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
                {t('onboarding.abel.complete')}
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
                    actionLabel: t('onboarding.abel.sceneOne.openLexique'),
                    onVersePress: advance,
                    onColorSelect: setActiveColor,
                  })}
                  {createSceneTwoLexique({
                    metrics,
                    reduceMotion,
                    highlightColor: activeColor,
                    resourceIllustration: sceneTwoIllustration,
                    resourceColor: sceneTwoIllustration
                      ? getSceneTwoNodeColor(sceneTwoIllustration, theme)
                      : undefined,
                    onCommentsPress: () =>
                      setSceneTwoIllustration(current =>
                        current === 'comments' ? undefined : 'comments'
                      ),
                    onComparisonsPress: () =>
                      setSceneTwoIllustration(current =>
                        current === 'comparisons' ? undefined : 'comparisons'
                      ),
                    onDictionaryPress: () =>
                      setSceneTwoIllustration(current =>
                        current === 'dictionary' ? undefined : 'dictionary'
                      ),
                    onReferencesPress: () =>
                      setSceneTwoIllustration(current =>
                        current === 'references' ? undefined : 'references'
                      ),
                    onThemesPress: () =>
                      setSceneTwoIllustration(current =>
                        current === 'themes' ? undefined : 'themes'
                      ),
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
                    onStrongPress: advance,
                    t,
                  })}
                  {createSceneFourOccurrences({
                    activeFilter: occurrenceFilter,
                    filterDirection: occurrenceFilterDirection,
                    highlightColor: activeColor,
                    metrics,
                    onAddNotePress: advance,
                    onFilterChange: changeOccurrenceFilter,
                    reduceMotion,
                    t,
                  })}
                  {createSceneFiveNotes({
                    highlightColor: activeColor,
                    metrics,
                    onAddTagPress: advance,
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
                    onCollapsePress: advance,
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
      </Box>

      <VStack width={contentWidth} alignSelf="center" pb={Math.max(insets.bottom, 24)} gap={20}>
        <Box height={76} center>
          {currentScene.id === 'scene-three' ? (
            <StrongCarouselPrompt
              carouselProgress={strongCarouselProgress}
              properPrompt={t(currentScene.promptKey)}
              commonPrompt={t('onboarding.abel.sceneThree.commonPhrase')}
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
        <Box height={58} center>
          <Animated.View
            style={{
              width: contentWidth,
              height: 58,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AnimatedPressable
              accessibilityRole={showFinalAction ? 'button' : 'progressbar'}
              accessibilityLabel={
                showFinalAction
                  ? t('onboarding.abel.start')
                  : t('onboarding.abel.progress', {
                      current: sceneIndex + 1,
                      total: ONBOARDING_SCENE_COUNT,
                    })
              }
              accessibilityValue={
                showFinalAction
                  ? undefined
                  : { min: 0, max: ONBOARDING_SCENE_COUNT, now: sceneIndex + 1 }
              }
              onPress={showFinalAction ? advance : undefined}
              onPressIn={showFinalAction ? handlePressIn : undefined}
              onPressOut={showFinalAction ? handlePressOut : undefined}
              style={{
                width: contentWidth,
                height: 58,
                opacity: opacityButton,
                transform: [{ scale: scaleButton }],
              }}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  left: showFinalAction ? 0 : compactHorizontalInset,
                  right: showFinalAction ? 0 : compactHorizontalInset,
                  top: showFinalAction ? 0 : compactVerticalInset,
                  bottom: showFinalAction ? 0 : compactVerticalInset,
                  borderRadius: showFinalAction ? 29 : 6,
                  backgroundColor: theme.colors.lightPrimary,
                  boxShadow: showFinalAction ? '0 5px 12px rgba(40,67,128,0.16)' : 'none',
                  overflow: 'hidden',
                  transitionProperty: [
                    'left',
                    'right',
                    'top',
                    'bottom',
                    'borderRadius',
                    'boxShadow',
                  ],
                  transitionDuration: 800,
                  transitionTimingFunction: cubicBezier(0.86, 0, 0.07, 1),
                }}
              >
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${progress * 100}%`,
                      backgroundColor: theme.colors.primary,
                      transitionProperty: 'width',
                      transitionDuration: 420,
                      transitionDelay: delayProgressAfterFinalBack && !reduceMotion ? 520 : 0,
                      transitionTimingFunction: 'ease-in-out',
                    },
                  ]}
                />
              </Animated.View>
              {showFinalAction ? (
                <AnimatedBox
                  absoluteFill
                  center
                  entering={reduceMotion ? undefined : finalActionLabelEntering}
                  exiting={FadeOut}
                >
                  <HStack alignItems="center" gap={12}>
                    <Text color="reverse" fontSize={17} bold>
                      {t('onboarding.abel.start')}
                    </Text>
                    <Feather name="arrow-right" size={23} color={theme.colors.reverse} />
                  </HStack>
                </AnimatedBox>
              ) : null}
            </AnimatedPressable>
          </Animated.View>
        </Box>
      </VStack>
    </AnimatedBox>
  )
}

export default AbelOnboarding
