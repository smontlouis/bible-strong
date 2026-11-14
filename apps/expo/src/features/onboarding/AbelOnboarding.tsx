import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable, useWindowDimensions } from 'react-native'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import type { AvatarHandle } from '@bible-strong/avatar-react-native'
import { useSetAtom } from 'jotai/react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { supportsOfflineCopies } from '~desktop/isDesktop'
import { OnboardingStage } from './abel/OnboardingStage'
import { SceneGraph } from './abel/SceneGraph'
import { onboardingScenes, type OnboardingSceneId } from './abel/sceneRegistry'
import { radii } from '~common/ui/surfaces'
import OnboardingButton from './OnboardingButton'
import { softHaptic, successHaptic, tapHaptic } from './onboardingHaptics'
import { createStrobiNode, type StrobiDirection, withStrobi } from './abel/strobiGuide'
import {
  createSceneStrobi,
  STROBI_SCENE_CONFIRMATION_CENTER,
  STROBI_SCENE_OFFER_CENTER,
  STROBI_SCENE_PLACEMENT,
  STROBI_SCENE_QUESTION_CENTER,
  type StrobiScenePhase,
} from './abel/scenes/SceneStrobi'
import { strobiTrialRequestedAtom } from './atom'
import { assistantAvailable } from '~features/study-assistant/assistantConfig'
import { useAssistantOpening } from '~helpers/assistantOpening'
import { isOnboardingForced } from '~helpers/runtimeConfig'
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
      className="text-[25px] leading-[32px] text-center"
      style={{ fontFamily: 'Literata Book' }}
    >
      {prompt}
    </Text>
  )

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous flex-[1] w-[100%] relative"
      entering={entering}
      exiting={exiting}
    >
      <AnimatedBox
        className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center"
        style={properPromptStyle}
      >
        {renderPrompt(properPrompt)}
      </AnimatedBox>
      <AnimatedBox
        className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center"
        style={commonPromptStyle}
      >
        {renderPrompt(commonPrompt)}
      </AnimatedBox>
    </AnimatedBox>
  )
}

// How long Strobi thinks before it answers, and how long a scene waits before Strobi points at its
// next action.
const STROBI_THINKING_MS = 1800
const NEXT_ARROW_HINT_MS = 4500

/**
 * What Strobi does in each scene, where it stands and what it looks at: the scene's next action.
 * Coordinates are design points of the 350 × 480 stage.
 */
const STROBI_IN_SCENES: Record<Exclude<OnboardingSceneId, 'scene-strobi'>, StrobiDirection> = {
  // Down at the verse.
  'scene-one': { placement: { x: 50, y: 38, size: 84 }, clip: 'Idle_B', lookAt: [0.25, -0.8] },
  // To the right, at the resources.
  'scene-two': { placement: { x: 60, y: 178, size: 70 }, state: 'idle', lookAt: [0.8, 0] },
  // Up and to the right, at the carousel.
  'scene-three': {
    placement: { x: 34, y: 430, size: 62 },
    state: 'surprised',
    lookAt: [0.6, 0.5],
  },
  // Down and to the left.
  'scene-four': {
    placement: { x: 300, y: 48, size: 64 },
    state: 'reading',
    lookAt: [-0.5, -0.7],
  },
  'scene-five': {
    placement: { x: 50, y: 424, size: 70 },
    state: 'listening',
    target: { x: 286, y: 276 },
  },
  'scene-six': {
    placement: { x: 46, y: 432, size: 62 },
    state: 'proud',
    target: { x: 321, y: 289 },
  },
  'scene-seven': { placement: { x: 175, y: 432, size: 88 }, state: 'celebrate' },
}

const strobiDirection = (
  sceneId: OnboardingSceneId,
  strobiPhase: StrobiScenePhase
): StrobiDirection => {
  if (sceneId !== 'scene-strobi') return STROBI_IN_SCENES[sceneId]
  if (strobiPhase === 'question') {
    return {
      placement: STROBI_SCENE_PLACEMENT,
      state: 'controlling',
      target: STROBI_SCENE_QUESTION_CENTER,
    }
  }
  if (strobiPhase === 'thinking') return { placement: STROBI_SCENE_PLACEMENT, state: 'thinking' }
  if (strobiPhase === 'accepted') {
    return {
      placement: STROBI_SCENE_PLACEMENT,
      state: 'happy',
      target: STROBI_SCENE_CONFIRMATION_CENTER,
    }
  }
  return { placement: STROBI_SCENE_PLACEMENT, state: 'happy', target: STROBI_SCENE_OFFER_CENTER }
}

const AbelOnboarding = ({ completionMode = 'handoff', onComplete }: AbelOnboardingProps) => {
  const stylingTheme = useStylingTheme()

  const theme = useTheme()
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const opening = useAssistantOpening()
  // Strobi's own scene shows while the assistant is open, and whenever the onboarding is forced
  // in development, so that it can be worked on.
  const strobiSceneOpen = assistantAvailable && (opening.open || isOnboardingForced)
  // Remote Config may answer while the reader goes through the scenes: what it said when the
  // first scene was left holds to the end, so that no scene appears or vanishes on the way.
  const [strobiSceneDecided, setStrobiSceneDecided] = useState<boolean>()
  const showStrobiScene = strobiSceneDecided ?? strobiSceneOpen
  const scenes = useMemo(() => onboardingScenes(showStrobiScene), [showStrobiScene])
  const sceneCount = scenes.length
  const [sceneIndex, setSceneIndex] = useState(0)
  const [strobiPhase, setStrobiPhase] = useState<StrobiScenePhase>('question')
  // Strobi's handle, set by a callback: a ref object handed to the scene graph would be frozen
  // by the worklets it reaches, and could no longer be set.
  const strobiRef = useRef<AvatarHandle | null>(null)
  const [setStrobiHandle] = useState(() => (handle: AvatarHandle | null) => {
    strobiRef.current = handle
  })
  const setStrobiTrialRequested = useSetAtom(strobiTrialRequestedAtom)
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
  const currentScene = scenes[Math.min(sceneIndex, sceneCount - 1)]
  const canGoBack = sceneIndex > 0
  const isFinalScene = currentScene.id === 'scene-seven'
  const sceneProgress = (sceneIndex + 1) / sceneCount
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

  const confirmSkip = async () => {
    const confirmed = await confirm({
      title: t('onboarding.abel.skipConfirmTitle'),
      // The browser has no Offline copies to choose: skipping leads straight into the app.
      message: t(
        supportsOfflineCopies
          ? 'onboarding.abel.skipConfirmMessage'
          : 'onboarding.abel.skipConfirmMessageOnline'
      ),
      cancelLabel: t('onboarding.abel.keepDiscovering'),
      confirmLabel: t('onboarding.abel.skip'),
    })
    if (confirmed) finish()
  }

  const advance = () => {
    if (progressDelayTimeout.current) clearTimeout(progressDelayTimeout.current)
    setDelayProgressAfterFinalBack(false)
    if (sceneIndex < sceneCount - 1) {
      if (sceneIndex === 0 && strobiSceneDecided === undefined) {
        setStrobiSceneDecided(strobiSceneOpen)
      }
      if (sceneIndex === sceneCount - 2) setIsFinalActionReady(false)
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

  // Strobi answers the question of its scene after a moment of thought.
  const strobiThinking = useRef<ReturnType<typeof setTimeout> | null>(null)
  const askStrobi = () => {
    if (strobiPhase !== 'question') return
    setStrobiPhase('thinking')
    strobiThinking.current = setTimeout(
      () => {
        setStrobiPhase('answer')
        softHaptic()
      },
      reduceMotion ? 0 : STROBI_THINKING_MS
    )
  }
  useEffect(
    () => () => {
      if (strobiThinking.current) clearTimeout(strobiThinking.current)
    },
    []
  )

  // The reader wants to try Strobi: the scene says what follows, and the app offers it once the
  // onboarding is over. The reader goes on with the arrow.
  const tryStrobi = () => {
    successHaptic()
    setStrobiPhase('accepted')
    strobiRef.current?.poke('nod')
    setStrobiTrialRequested(true)
  }

  // Touching Strobi only makes it spin: the arrow and the scene's own actions lead on.
  const pressStrobi = () => {
    strobiRef.current?.poke('spin')
  }

  // Strobi nods at each colour the reader picks.
  const firstColor = useRef(true)
  useEffect(() => {
    if (firstColor.current) {
      firstColor.current = false
      return
    }
    strobiRef.current?.poke('nod')
  }, [activeColor])

  // The arrow leads on from every scene but the last, whose progress bar becomes « Commencer ».
  // A reader who waits on a scene sees it pulse.
  const showNextArrow = !isFinalScene
  const nextArrowVisible = useSharedValue(showNextArrow ? 1 : 0)
  const nextArrowPulse = useSharedValue(1)
  useEffect(() => {
    nextArrowVisible.set(reduceMotion ? (showNextArrow ? 1 : 0) : withSpring(showNextArrow ? 1 : 0))
  }, [nextArrowVisible, reduceMotion, showNextArrow])
  useEffect(() => {
    nextArrowPulse.set(1)
    if (reduceMotion || !showNextArrow) return
    if (currentScene.id === 'scene-strobi' && strobiPhase === 'thinking') return
    // Once the reader has asked to try Strobi, the arrow shows at once how to go on.
    const accepted = currentScene.id === 'scene-strobi' && strobiPhase === 'accepted'
    const timeout = setTimeout(
      () => {
        nextArrowPulse.set(
          withRepeat(
            withSequence(withTiming(1.12, { duration: 220 }), withTiming(1, { duration: 260 })),
            2
          )
        )
      },
      accepted ? 500 : NEXT_ARROW_HINT_MS
    )
    return () => clearTimeout(timeout)
  }, [currentScene.id, nextArrowPulse, reduceMotion, showNextArrow, strobiPhase])
  const nextArrowStyle = useAnimatedStyle(() => ({
    opacity: nextArrowVisible.get(),
    transform: [{ scale: nextArrowPulse.get() * (0.6 + 0.4 * nextArrowVisible.get()) }],
  }))

  const strobiFor = (
    sceneId: OnboardingSceneId,
    metrics: Parameters<typeof createStrobiNode>[0]['metrics']
  ) =>
    createStrobiNode({
      direction: strobiDirection(sceneId, strobiPhase),
      metrics,
      strobiRef: setStrobiHandle,
      onPress: pressStrobi,
    })

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
      className="overflow-hidden border-continuous flex-[1] bg-light-grey"
      pointerEvents={isFinishing ? 'none' : 'auto'}
      style={[
        { paddingTop: insets.top },
        {
          opacity: isFinishing && completionMode === 'handoff' ? 0 : 1,
          transitionProperty: 'opacity',
          transitionDuration: reduceMotion ? 0 : 240,
          transitionTimingFunction: 'ease-out',
        },
      ]}
    >
      <OnboardingButton
        pointerEvents={canGoBack ? 'auto' : 'none'}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.abel.back')}
        enabled={canGoBack}
        onPress={() => {
          tapHaptic()
          goBack()
        }}
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
      </OnboardingButton>

      <Box
        className="overflow-hidden border-continuous h-[28px] mt-[19px] self-center relative"
        style={[{ width: contentWidth }, { zIndex: 1000 }]}
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
          <Text className="text-tertiary text-[13px]">{t('onboarding.abel.skip')}</Text>
        </Pressable>
      </Box>

      <Box
        className="border-continuous overflow-visible flex-[1] px-[12px]"
        onLayout={({ nativeEvent }) => {
          const nextHeight = nativeEvent.layout.height
          setSceneViewportHeight(currentHeight =>
            currentHeight === nextHeight ? currentHeight : nextHeight
          )
        }}
      >
        <AnimatedBox
          className="border-continuous overflow-visible flex-[1]"
          key={isFinishing && completionMode === 'confirmation' ? 'confirmation' : 'scenes'}
          collapsable={false}
          entering={reduceMotion ? undefined : FadeIn.springify()}
          exiting={reduceMotion ? undefined : FadeOut.springify()}
        >
          {isFinishing && completionMode === 'confirmation' ? (
            <VStack className="overflow-hidden border-continuous flex-[1] items-center justify-center gap-[12px]">
              <AnimatedBox
                className="overflow-hidden border-continuous rounded-[36px] bg-light-primary items-center justify-center"
                entering={reduceMotion ? undefined : FadeInDown.springify()}
                style={{ width: 72, height: 72 }}
              >
                <Feather name="check" size={30} color={theme.colors.primary} />
              </AnimatedBox>
              <Text className="text-[27px] text-center" style={titleFontStyle(stylingTheme)}>
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
                  {withStrobi(
                    createSceneOneVerseHighlight({
                      metrics,
                      reduceMotion,
                      activeColor,
                      actionLabel: t('onboarding.abel.sceneOne.openLexique'),
                      onVersePress: advance,
                      onColorSelect: setActiveColor,
                    }),
                    strobiFor('scene-one', metrics)
                  )}
                  {withStrobi(
                    createSceneTwoLexique({
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
                    }),
                    strobiFor('scene-two', metrics)
                  )}
                  {withStrobi(
                    createSceneThreeStrong({
                      activeIndex: strongCardIndex,
                      carouselProgress: strongCarouselProgress,
                      metrics,
                      reduceMotion,
                      highlightColor: activeColor,
                      onIndexChange: setStrongCardIndex,
                      onStrongPress: advance,
                      t,
                    }),
                    strobiFor('scene-three', metrics)
                  )}
                  {withStrobi(
                    createSceneFourOccurrences({
                      activeFilter: occurrenceFilter,
                      filterDirection: occurrenceFilterDirection,
                      highlightColor: activeColor,
                      metrics,
                      onAddNotePress: advance,
                      onFilterChange: changeOccurrenceFilter,
                      reduceMotion,
                      t,
                    }),
                    strobiFor('scene-four', metrics)
                  )}
                  {showStrobiScene &&
                    withStrobi(
                      createSceneStrobi({
                        metrics,
                        phase: strobiPhase,
                        reduceMotion,
                        onAsk: askStrobi,
                        onTry: tryStrobi,
                        onLater: advance,
                        t,
                      }),
                      strobiFor('scene-strobi', metrics)
                    )}
                  {withStrobi(
                    createSceneFiveNotes({
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
                    }),
                    strobiFor('scene-five', metrics)
                  )}
                  {withStrobi(
                    createSceneSixRelations({
                      theme,
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
                    }),
                    strobiFor('scene-six', metrics)
                  )}
                  {withStrobi(
                    createSceneSevenReturnToVerse({
                      highlightColor: activeColor,
                      metrics,
                      reduceMotion,
                      t,
                    }),
                    strobiFor('scene-seven', metrics)
                  )}
                </SceneGraph>
              )}
            </OnboardingStage>
          )}
        </AnimatedBox>
      </Box>

      <VStack
        className="overflow-hidden border-continuous self-center gap-[20px]"
        style={{ paddingBottom: Math.max(insets.bottom, 24), width: contentWidth }}
      >
        <Box className="overflow-hidden border-continuous h-[76px] items-center justify-center">
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
              collapsable={false}
              entering={
                reduceMotion ? undefined : isFinalScene ? finalPromptEntering : promptEntering
              }
              exiting={reduceMotion ? undefined : promptExiting}
              className="overflow-hidden border-continuous"
            >
              <Text
                className="text-center"
                style={{
                  fontSize: currentScene.id === 'scene-one' ? 32 : isFinalScene ? 22 : 25,
                  // Three lines of the final phrase must fit the 76-point box, or iOS crams the end
                  // of the text onto its last line.
                  lineHeight: currentScene.id === 'scene-one' ? 38 : isFinalScene ? 25 : 32,
                  fontFamily: 'Literata Book',
                }}
              >
                {t(promptKey)}
              </Text>
            </AnimatedBox>
          )}
        </Box>
        <Box className="overflow-hidden border-continuous h-[58px] items-center justify-center">
          <Animated.View
            style={{
              width: contentWidth,
              height: 58,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OnboardingButton
              accessibilityRole={showFinalAction ? 'button' : 'progressbar'}
              accessibilityLabel={
                showFinalAction
                  ? t('onboarding.abel.start')
                  : t('onboarding.abel.progress', {
                      current: sceneIndex + 1,
                      total: sceneCount,
                    })
              }
              accessibilityValue={
                showFinalAction ? undefined : { min: 0, max: sceneCount, now: sceneIndex + 1 }
              }
              onPress={
                showFinalAction
                  ? () => {
                      tapHaptic()
                      advance()
                    }
                  : undefined
              }
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
                  style={{
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
                  }}
                />
              </Animated.View>
              {showFinalAction ? (
                <AnimatedBox
                  className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center"
                  entering={reduceMotion ? undefined : finalActionLabelEntering}
                  exiting={FadeOut}
                >
                  <HStack className="overflow-hidden border-continuous items-center gap-[12px]">
                    <Text className="text-reverse text-[17px] font-bold">
                      {t('onboarding.abel.start')}
                    </Text>
                    <Feather name="arrow-right" size={23} color={theme.colors.reverse} />
                  </HStack>
                </AnimatedBox>
              ) : null}
            </OnboardingButton>
          </Animated.View>
          <OnboardingButton
            pointerEvents={showNextArrow ? 'auto' : 'none'}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.abel.next')}
            accessibilityElementsHidden={!showNextArrow}
            importantForAccessibility={showNextArrow ? 'auto' : 'no-hide-descendants'}
            enabled={showNextArrow}
            onPress={() => {
              tapHaptic()
              advance()
            }}
            hitSlop={8}
            style={[
              {
                position: 'absolute',
                right: 0,
                top: 7,
                width: 44,
                height: 44,
                borderRadius: radii.pill,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              },
              nextArrowStyle,
            ]}
          >
            <Feather name="arrow-right" size={21} color="#FFFFFF" />
          </OnboardingButton>
        </Box>
      </VStack>
    </AnimatedBox>
  )
}

export default AbelOnboarding
