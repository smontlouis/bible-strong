import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  FadeIn,
  FadeOut,
  Extrapolation,
  interpolate,
  type EntryExitAnimationFunction,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated'
import Svg, { Circle, G, type CircleProps } from 'react-native-svg'
import Box, { AnimatedBox, FadingBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useTranslation } from 'react-i18next'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
import { getRandomBibleFactIndex, OFFLINE_SETUP_BIBLE_FACT_KEYS } from './offlineSetupBibleFacts'
import { getOfflineSetupOverviewPalette, type OfflineSetupPalette } from './offlineSetupPalette'
import useOfflineSetupDownload, {
  type OfflineSetupDownloadPhase,
  type OfflineSetupSuccessMessage,
} from './useOfflineSetupDownload'
type DownloadResourcesProps = {
  canvasVisible?: boolean
  transitioning?: boolean
} & ({ mode?: 'onboarding'; onComplete: () => void } | { mode: 'preview'; onComplete?: never })

const RING_SIZE = 184
const RING_RADIUS = 72
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const DOWNLOAD_REVEAL = OFFLINE_SETUP_MOTION.download.reveal
const DOWNLOAD_SUCCESS = OFFLINE_SETUP_MOTION.download.success

const useRotatingBibleFact = (active: boolean) => {
  const [factIndex, setFactIndex] = useState(() => getRandomBibleFactIndex())

  useEffect(() => {
    if (!active) return undefined
    const interval = setInterval(() => {
      setFactIndex(getRandomBibleFactIndex)
    }, OFFLINE_SETUP_MOTION.download.preview.factRotationDuration)
    return () => clearInterval(interval)
  }, [active])

  return OFFLINE_SETUP_BIBLE_FACT_KEYS[factIndex]
}

const successMessageEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 5 }, { scale: 0.98 }] },
    animations: {
      opacity: withSpring(1),
      transform: [{ translateY: withSpring(0) }, { scale: withSpring(1) }],
    },
  }
}

const successMessageExiting: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withSpring(0),
      transform: [{ translateY: withSpring(-5) }, { scale: withSpring(0.98) }],
    },
  }
}

type RingAnimatedProps = React.ComponentProps<typeof AnimatedCircle>['animatedProps']

const useStaggeredRevealStyle = ({
  delay,
  initialScale,
  initialTranslateY = 0,
  reduceMotion,
  visible,
}: {
  delay: number
  initialScale: number
  initialTranslateY?: number
  reduceMotion: boolean
  visible: boolean
}) => {
  const motionProgress = useSharedValue(visible ? 1 : 0)
  const opacityProgress = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    const target = visible ? 1 : 0
    if (reduceMotion) {
      motionProgress.set(target)
      opacityProgress.set(target)
      return
    }

    const opacityDuration = visible
      ? DOWNLOAD_REVEAL.opacityInDuration
      : DOWNLOAD_REVEAL.opacityOutDuration
    const opacityAnimation = withTiming(target, { duration: opacityDuration })
    const motionAnimation = withSpring(target, {
      damping: DOWNLOAD_REVEAL.spring.damping,
      stiffness: DOWNLOAD_REVEAL.spring.stiffness,
      mass: DOWNLOAD_REVEAL.spring.mass,
    })

    if (visible && delay > 0) {
      opacityProgress.set(withDelay(delay, opacityAnimation))
      motionProgress.set(withDelay(delay, motionAnimation))
      return
    }

    opacityProgress.set(opacityAnimation)
    motionProgress.set(motionAnimation)
  }, [delay, motionProgress, opacityProgress, reduceMotion, visible])

  return useAnimatedStyle(() => {
    const progress = motionProgress.get()
    return {
      opacity: opacityProgress.get(),
      transform: [
        {
          scale: interpolate(progress, [0, 1], [initialScale, 1], Extrapolation.CLAMP),
        },
        {
          translateY: interpolate(progress, [0, 1], [initialTranslateY, 0], Extrapolation.CLAMP),
        },
      ],
    }
  })
}

const DownloadProgressContent = ({
  animatedProps,
  displayProgress,
  palette,
  reduceMotion,
  transitioning,
}: {
  animatedProps: RingAnimatedProps
  displayProgress: number
  palette: OfflineSetupPalette
  reduceMotion: boolean
  transitioning: boolean
}) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const visible = !transitioning
  const bibleFactKey = useRotatingBibleFact(visible)
  const progressRevealStyle = useStaggeredRevealStyle({
    delay: DOWNLOAD_REVEAL.progressDelay,
    initialScale: 0.72,
    reduceMotion,
    visible,
  })
  const titleRevealStyle = useStaggeredRevealStyle({
    delay: DOWNLOAD_REVEAL.titleDelay,
    initialScale: 0.98,
    initialTranslateY: 8,
    reduceMotion,
    visible,
  })
  const subtitleRevealStyle = useStaggeredRevealStyle({
    delay: DOWNLOAD_REVEAL.subtitleDelay,
    initialScale: 1,
    initialTranslateY: 6,
    reduceMotion,
    visible,
  })

  return (
    <Box className="border-continuous overflow-visible items-center">
      <AnimatedBox
        className="border-continuous overflow-visible items-center justify-center"
        style={[
          {
            borderRadius: RING_SIZE / 2,
            ...(RING_SIZE ? { width: RING_SIZE, height: RING_SIZE } : {}),
          },
          [{ boxShadow: `0 22px 55px ${palette.accentShadow}` }, progressRevealStyle],
        ]}
      >
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
          <G rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill={palette.itemSurface}
              stroke={palette.itemBorder}
              strokeWidth={8}
            />
            <AnimatedCircle
              animatedProps={animatedProps}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="transparent"
              stroke={palette.accent}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            />
          </G>
        </Svg>
        <Text
          className="text-[31px]"
          style={[
            {
              color: resolveThemeColor(stylingTheme, palette.title) || stylingTheme.colors.default,
              fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
            },
            { fontFamily: 'FiraCode' },
          ]}
        >
          {Math.round(displayProgress * 100)}%
        </Text>
      </AnimatedBox>

      <AnimatedBox
        className="overflow-hidden border-continuous items-center"
        style={titleRevealStyle}
      >
        <Text
          className="text-[25px] leading-[30px] text-center mt-[30px]"
          style={{
            color: resolveThemeColor(stylingTheme, palette.title) || stylingTheme.colors.default,
            fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
          }}
        >
          {t('offlineSetup.didYouKnow')}
        </Text>
      </AnimatedBox>
      <AnimatedBox
        className="overflow-hidden border-continuous w-[100%] h-[92px] items-center"
        style={subtitleRevealStyle}
      >
        <FadingBox
          className="overflow-hidden border-continuous w-[100%] items-center"
          keyProp={bibleFactKey}
          entering={reduceMotion ? undefined : FadeIn.duration(280)}
          exiting={reduceMotion ? undefined : FadeOut.duration(180)}
          skipEntering={false}
          skipExiting={false}
        >
          <Text
            className="text-[14px] leading-[20px] text-center mt-[10px] max-w-[320px]"
            style={{
              color:
                resolveThemeColor(stylingTheme, palette.description) || stylingTheme.colors.default,
            }}
          >
            {t(bibleFactKey)}
          </Text>
        </FadingBox>
      </AnimatedBox>
    </Box>
  )
}

const DownloadSuccessContent = ({
  reduceMotion,
  successMessage,
  palette,
}: {
  reduceMotion: boolean
  successMessage: OfflineSetupSuccessMessage
  palette: OfflineSetupPalette
}) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()

  const message = () => {
    if (successMessage === 'ready') {
      return (
        <Text
          className="text-[31px] leading-[38px] text-center"
          style={[
            {
              color: resolveThemeColor(stylingTheme, palette.title) || stylingTheme.colors.default,
            },
            { fontFamily: 'Literata Book' },
          ]}
        >
          {t('offlineSetup.downloadReady')}
        </Text>
      )
    }

    return (
      <VStack className="overflow-hidden border-continuous items-center">
        <Text
          className="text-[18px] leading-[24px] text-center"
          style={[
            {
              color:
                resolveThemeColor(stylingTheme, palette.description) || stylingTheme.colors.default,
            },
            { fontFamily: 'Literata Book' },
          ]}
        >
          {t('offlineSetup.downloadWelcomePrefix')}
        </Text>
        <Text
          className="text-[31px] leading-[38px] text-center"
          style={[
            {
              color: resolveThemeColor(stylingTheme, palette.title) || stylingTheme.colors.default,
            },
            { fontFamily: 'Literata Book' },
          ]}
        >
          Bible Strong
        </Text>
      </VStack>
    )
  }

  return (
    <VStack className="border-continuous overflow-visible w-[100%] items-center">
      <Box
        className="border-continuous overflow-visible items-center justify-center"
        style={{ width: 164, height: 164 }}
      >
        <AnimatedBox
          className="border-continuous overflow-visible rounded-[66px] items-center justify-center"
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(15).stiffness(165)}
          style={[
            {
              backgroundColor: resolveThemeColor(stylingTheme, palette.accent),
              width: 132,
              height: 132,
            },
            { boxShadow: `0 22px 55px ${palette.accentShadow}` },
          ]}
        >
          <Feather name="check" size={56} color={palette.onAccent} />
        </AnimatedBox>
      </Box>
      <Box className="border-continuous overflow-visible w-[100%] h-[84px] mt-[16px] items-center justify-center">
        {successMessage ? (
          <FadingBox
            className="border-continuous overflow-visible absolute left-[0px] top-[0px] right-[0px] bottom-[0px] items-center justify-center"
            keyProp={successMessage}
            entering={reduceMotion ? undefined : successMessageEntering}
            exiting={reduceMotion ? undefined : successMessageExiting}
            skipEntering={false}
            skipExiting={false}
          >
            {message()}
          </FadingBox>
        ) : null}
      </Box>
    </VStack>
  )
}

const DownloadErrorContent = ({
  error,
  onRetry,
  palette,
}: {
  error: Error | null
  onRetry: () => void
  palette: OfflineSetupPalette
}) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()

  return (
    <VStack className="overflow-hidden border-continuous items-center px-[16px]">
      <Box
        className="overflow-hidden border-continuous rounded-[44px] bg-[#FCE4E8] items-center justify-center"
        style={{ width: 88, height: 88 }}
      >
        <Feather name="alert-circle" size={38} color="#D84D6D" />
      </Box>
      <Text
        className="text-[24px] text-center mt-[24px]"
        style={{
          color: resolveThemeColor(stylingTheme, palette.title) || stylingTheme.colors.default,
          fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
        }}
      >
        {t('offlineSetup.downloadError')}
      </Text>
      <Text
        className="text-[13px] leading-[19px] text-center mt-[9px]"
        style={{
          color:
            resolveThemeColor(stylingTheme, palette.description) || stylingTheme.colors.default,
        }}
      >
        {error?.message}
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry}>
        {({ pressed }) => (
          <Box
            className="overflow-hidden border-continuous mt-[24px] min-w-[150px] h-[48px] px-[24px] rounded-[24px] items-center justify-center"
            style={{
              backgroundColor: resolveThemeColor(stylingTheme, palette.accent),
              opacity: pressed ? 0.76 : 1,
            }}
          >
            <Text
              className="font-bold text-[15px]"
              style={{
                color:
                  resolveThemeColor(stylingTheme, palette.onAccent) || stylingTheme.colors.default,
              }}
            >
              {t('downloads.retry')}
            </Text>
          </Box>
        )}
      </Pressable>
    </VStack>
  )
}

const DownloadPhaseContent = ({
  animatedProps,
  displayProgress,
  error,
  phase,
  palette,
  reduceMotion,
  retry,
  successMessage,
  transitioning,
}: {
  animatedProps: RingAnimatedProps
  displayProgress: number
  error: Error | null
  phase: OfflineSetupDownloadPhase
  palette: OfflineSetupPalette
  reduceMotion: boolean
  retry: () => void
  successMessage: OfflineSetupSuccessMessage
  transitioning: boolean
}) => {
  if (phase === 'downloading') {
    return (
      <DownloadProgressContent
        animatedProps={animatedProps}
        displayProgress={displayProgress}
        palette={palette}
        reduceMotion={reduceMotion}
        transitioning={transitioning}
      />
    )
  }

  if (phase === 'success') {
    return (
      <DownloadSuccessContent
        palette={palette}
        reduceMotion={reduceMotion}
        successMessage={successMessage}
      />
    )
  }

  return <DownloadErrorContent error={error} onRetry={retry} palette={palette} />
}

const DownloadResources = (props: DownloadResourcesProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const theme = useTheme()
  const { colorScheme } = useCurrentThemeSelector()
  const palette = getOfflineSetupOverviewPalette(theme, colorScheme)
  const reduceMotion = useReducedMotion()
  const insets = useSafeAreaInsets()
  const { closing, displayProgress, error, phase, retry, successMessage } = useOfflineSetupDownload(
    {
      mode: props.mode ?? 'onboarding',
      onComplete: props.onComplete,
      reduceMotion,
    }
  )
  const ringProgress = useSharedValue(0)
  const canvasVisible = props.canvasVisible ?? true
  const transitioning = props.transitioning ?? false
  const backgroundRevealStyle = useStaggeredRevealStyle({
    delay: DOWNLOAD_REVEAL.backgroundDelay,
    initialScale: 0.76,
    reduceMotion,
    visible: !transitioning,
  })

  useEffect(() => {
    ringProgress.set(withTiming(displayProgress, { duration: reduceMotion ? 0 : 280 }))
  }, [displayProgress, reduceMotion, ringProgress])

  const ringAnimatedProps = useAnimatedProps<CircleProps>(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.get()),
  }))

  return (
    <AnimatedBox
      className="border-continuous overflow-visible flex-[1] items-center justify-center px-[32px]"
      style={[
        {
          backgroundColor: resolveThemeColor(
            stylingTheme,
            canvasVisible ? palette.canvas : 'transparent'
          ),
        },
        {
          opacity: closing ? 0 : 1,
          transitionProperty: 'opacity',
          transitionDuration: reduceMotion ? 0 : DOWNLOAD_SUCCESS.fadeOutDuration,
          transitionTimingFunction: 'ease-out',
        },
      ]}
    >
      <AnimatedBox
        className="overflow-hidden border-continuous absolute rounded-[165px]"
        style={[
          {
            backgroundColor: resolveThemeColor(stylingTheme, palette.ambientAccentSoft),
            width: 330,
            height: 330,
          },
          backgroundRevealStyle,
        ]}
      />

      <FadingBox
        className="border-continuous overflow-visible w-[100%] items-center"
        keyProp={phase}
        entering={reduceMotion || phase === 'downloading' ? undefined : FadeIn.duration(340)}
        exiting={reduceMotion ? undefined : FadeOut.duration(220)}
        skipEntering={false}
        skipExiting={false}
      >
        <DownloadPhaseContent
          animatedProps={ringAnimatedProps}
          displayProgress={displayProgress}
          error={error}
          phase={phase}
          palette={palette}
          reduceMotion={reduceMotion}
          retry={retry}
          successMessage={successMessage}
          transitioning={transitioning}
        />
      </FadingBox>
      {props.mode !== 'preview' && phase !== 'success' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSetup.continueInApp')}
          onPress={props.onComplete}
          style={{ position: 'absolute', top: Math.max(insets.top, 16) + 8, right: 18 }}
        >
          {({ pressed }) => (
            <Box
              className="overflow-hidden border-continuous px-[13px] h-[36px] rounded-[18px] bg-reverse items-center justify-center"
              style={{ opacity: pressed ? 0.7 : 0.92 }}
            >
              <Text className="text-tertiary font-bold text-[12px]">
                {t('offlineSetup.continueInApp')}
              </Text>
            </Box>
          )}
        </Pressable>
      )}
    </AnimatedBox>
  )
}

export default DownloadResources
