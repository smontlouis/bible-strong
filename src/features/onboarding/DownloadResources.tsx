import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
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
import { useTranslation } from 'react-i18next'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
import { getNextBibleFactIndex, OFFLINE_SETUP_BIBLE_FACT_KEYS } from './offlineSetupBibleFacts'
import useOfflineSetupDownload, {
  type OfflineSetupDownloadPhase,
  type OfflineSetupSuccessMessage,
} from './useOfflineSetupDownload'

type DownloadResourcesProps = {
  transitioning?: boolean
} & ({ mode?: 'onboarding'; onComplete: () => void } | { mode: 'preview'; onComplete?: never })

const RING_SIZE = 184
const RING_RADIUS = 72
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const DOWNLOAD_REVEAL = OFFLINE_SETUP_MOTION.download.reveal
const DOWNLOAD_SUCCESS = OFFLINE_SETUP_MOTION.download.success

const useRotatingBibleFact = (active: boolean) => {
  const [factIndex, setFactIndex] = useState(0)

  useEffect(() => {
    if (!active) return undefined
    const interval = setInterval(() => {
      setFactIndex(getNextBibleFactIndex)
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
  reduceMotion,
  transitioning,
}: {
  animatedProps: RingAnimatedProps
  displayProgress: number
  reduceMotion: boolean
  transitioning: boolean
}) => {
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
    <Box alignItems="center" overflow="visible">
      <AnimatedBox
        size={RING_SIZE}
        borderRadius={RING_SIZE / 2}
        center
        overflow="visible"
        style={[{ boxShadow: '0 22px 55px rgba(89,131,240,0.22)' }, progressRevealStyle]}
      >
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
          <G rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="#FFFFFF"
              stroke="#DEE7FA"
              strokeWidth={8}
            />
            <AnimatedCircle
              animatedProps={animatedProps}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="transparent"
              stroke="#5983F0"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            />
          </G>
        </Svg>
        <Text color="#142033" title fontSize={31} style={{ fontFamily: 'FiraCode' }}>
          {Math.round(displayProgress * 100)}%
        </Text>
      </AnimatedBox>

      <AnimatedBox alignItems="center" style={titleRevealStyle}>
        <Text title fontSize={25} lineHeight={30} textAlign="center" mt={30}>
          {t('offlineSetup.didYouKnow')}
        </Text>
      </AnimatedBox>
      <AnimatedBox width="100%" height={92} alignItems="center" style={subtitleRevealStyle}>
        <FadingBox
          keyProp={bibleFactKey}
          width="100%"
          alignItems="center"
          entering={reduceMotion ? undefined : FadeIn.duration(280)}
          exiting={reduceMotion ? undefined : FadeOut.duration(180)}
          skipEntering={false}
          skipExiting={false}
        >
          <Text
            color="#68758C"
            fontSize={14}
            lineHeight={20}
            textAlign="center"
            mt={10}
            maxWidth={320}
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
}: {
  reduceMotion: boolean
  successMessage: OfflineSetupSuccessMessage
}) => {
  const { t } = useTranslation()

  const message = () => {
    if (successMessage === 'ready') {
      return (
        <Text
          fontSize={31}
          lineHeight={38}
          textAlign="center"
          style={{ fontFamily: 'Literata Book' }}
        >
          {t('offlineSetup.downloadReady')}
        </Text>
      )
    }

    return (
      <VStack alignItems="center">
        <Text
          color="#68758C"
          fontSize={18}
          lineHeight={24}
          textAlign="center"
          style={{ fontFamily: 'Literata Book' }}
        >
          {t('offlineSetup.downloadWelcomePrefix')}
        </Text>
        <Text
          fontSize={31}
          lineHeight={38}
          textAlign="center"
          style={{ fontFamily: 'Literata Book' }}
        >
          Bible Strong
        </Text>
      </VStack>
    )
  }

  return (
    <VStack width="100%" alignItems="center" overflow="visible">
      <Box size={164} center overflow="visible">
        <AnimatedBox
          size={132}
          borderRadius={66}
          bg="#5983F0"
          center
          overflow="visible"
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(15).stiffness(165)}
          style={{ boxShadow: '0 22px 55px rgba(89,131,240,0.28)' }}
        >
          <Feather name="check" size={56} color="#FFFFFF" />
        </AnimatedBox>
      </Box>
      <Box width="100%" height={84} mt={16} center overflow="visible">
        {successMessage ? (
          <FadingBox
            keyProp={successMessage}
            absoluteFill
            center
            overflow="visible"
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

const DownloadErrorContent = ({ error, onRetry }: { error: Error | null; onRetry: () => void }) => {
  const { t } = useTranslation()

  return (
    <VStack alignItems="center" px={16}>
      <Box size={88} borderRadius={44} bg="#FCE4E8" center>
        <Feather name="alert-circle" size={38} color="#D84D6D" />
      </Box>
      <Text title fontSize={24} textAlign="center" mt={24}>
        {t('offlineSetup.downloadError')}
      </Text>
      <Text color="#68758C" fontSize={13} lineHeight={19} textAlign="center" mt={9}>
        {error?.message}
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry}>
        {({ pressed }) => (
          <Box
            mt={24}
            minWidth={150}
            height={48}
            px={24}
            borderRadius={24}
            bg="#5983F0"
            center
            opacity={pressed ? 0.76 : 1}
          >
            <Text color="#FFFFFF" bold fontSize={15}>
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
  reduceMotion,
  retry,
  successMessage,
  transitioning,
}: {
  animatedProps: RingAnimatedProps
  displayProgress: number
  error: Error | null
  phase: OfflineSetupDownloadPhase
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
        reduceMotion={reduceMotion}
        transitioning={transitioning}
      />
    )
  }

  if (phase === 'success') {
    return <DownloadSuccessContent reduceMotion={reduceMotion} successMessage={successMessage} />
  }

  return <DownloadErrorContent error={error} onRetry={retry} />
}

const DownloadResources = (props: DownloadResourcesProps) => {
  const reduceMotion = useReducedMotion()
  const { closing, displayProgress, error, phase, retry, successMessage } = useOfflineSetupDownload(
    {
      mode: props.mode ?? 'onboarding',
      onComplete: props.onComplete,
      reduceMotion,
    }
  )
  const ringProgress = useSharedValue(0)
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
      flex
      bg={transitioning ? 'transparent' : '#F4F7FF'}
      center
      px={32}
      overflow="hidden"
      style={{
        opacity: closing ? 0 : 1,
        transitionProperty: 'opacity',
        transitionDuration: reduceMotion ? 0 : DOWNLOAD_SUCCESS.fadeOutDuration,
        transitionTimingFunction: 'ease-out',
      }}
    >
      <AnimatedBox
        position="absolute"
        size={330}
        borderRadius={165}
        bg="rgba(89,131,240,0.08)"
        style={backgroundRevealStyle}
      />

      <FadingBox
        keyProp={phase}
        entering={reduceMotion || phase === 'downloading' ? undefined : FadeIn.duration(340)}
        exiting={reduceMotion ? undefined : FadeOut.duration(220)}
        skipEntering={false}
        skipExiting={false}
        width="100%"
        alignItems="center"
        overflow="visible"
      >
        <DownloadPhaseContent
          animatedProps={ringAnimatedProps}
          displayProgress={displayProgress}
          error={error}
          phase={phase}
          reduceMotion={reduceMotion}
          retry={retry}
          successMessage={successMessage}
          transitioning={transitioning}
        />
      </FadingBox>
    </AnimatedBox>
  )
}

export default DownloadResources
