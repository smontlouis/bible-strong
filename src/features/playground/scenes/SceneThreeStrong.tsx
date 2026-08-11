import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { ActivityIndicator, Pressable } from 'react-native'
import Carousel, { Pagination, type TAnimationStyle } from 'react-native-reanimated-carousel'
import { Extrapolation, interpolate, type SharedValue } from 'react-native-reanimated'

import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import SceneDecorativePluses from '../onboarding/SceneDecorativePluses'
import { Scene } from '../onboarding/SceneGraph'
import VerseCard, { type HighlightColor } from '../onboarding/VerseCard'

type StrongCardIndex = 0 | 1

type StrongDefinition = {
  code: '1892' | '1893'
  transliterationKey: string
  titleKey: string
  definitionKey: string
  typeKey: string
}

const STRONG_DEFINITIONS: readonly StrongDefinition[] = [
  {
    code: '1893',
    transliterationKey: 'playground.sceneThree.properTransliteration',
    titleKey: 'playground.sceneThree.properTitle',
    definitionKey: 'playground.sceneThree.properDefinition',
    typeKey: 'playground.sceneThree.properType',
  },
  {
    code: '1892',
    transliterationKey: 'playground.sceneThree.commonTransliteration',
    titleKey: 'playground.sceneThree.commonTitle',
    definitionKey: 'playground.sceneThree.commonDefinition',
    typeKey: 'playground.sceneThree.commonType',
  },
] as const

const strongAudioUrl = (code: StrongDefinition['code']) =>
  `https://content.swncdn.com/biblestudytools/audio/lexicons/hebrew-mp3/${code}h.mp3`

type StrongDefinitionCardProps = {
  definition: StrongDefinition
  metrics: OnboardingStageMetrics
  onActionPress: () => void
  t: TFunction
}

const StrongDefinitionCard = ({
  definition,
  metrics,
  onActionPress,
  t,
}: StrongDefinitionCardProps) => {
  const theme = useTheme()
  const s = metrics.s
  const isAction = definition.code === '1892'
  const player = useAudioPlayer(null)
  const audioStatus = useAudioPlayerStatus(player)
  const [hasRequestedAudio, setHasRequestedAudio] = useState(false)

  const playAudio = () => {
    setHasRequestedAudio(true)
    ;(async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true })
        player.replace(strongAudioUrl(definition.code))
        player.play()
      } catch {
        setHasRequestedAudio(false)
      }
    })()
  }

  return (
    <Box
      flex={1}
      bg="reverse"
      borderRadius={s(26)}
      px={s(22)}
      pt={s(22)}
      pb={s(18)}
      overflow="visible"
      style={{ boxShadow: '0 10px 26px rgba(40,67,128,0.16)' }}
    >
      <HStack justifyContent="space-between" alignItems="center" overflow="visible">
        <Box bg="lightPrimary" borderRadius={s(11)} px={s(10)} py={s(8)}>
          <Text color="primary" bold fontSize={s(10)} style={{ letterSpacing: s(1.8) }}>
            {t('playground.sceneThree.strongLabel')}
          </Text>
        </Box>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('playground.sceneThree.listen')}
          onPress={playAudio}
          style={({ pressed }) => ({
            overflow: 'visible',
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <Box
            size={s(48)}
            borderRadius={s(24)}
            bg="reverse"
            center
            overflow="visible"
            style={{ boxShadow: '0 5px 14px rgba(89,131,240,0.16)' }}
          >
            {hasRequestedAudio && audioStatus.isBuffering ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Feather
                name="volume-2"
                size={s(23)}
                color={theme.colors.primary}
                style={{ opacity: audioStatus.playing ? 0.48 : 1 }}
              />
            )}
          </Box>
        </Pressable>
      </HStack>

      <VStack alignItems="center" mt={s(8)}>
        <Text
          fontSize={s(65)}
          lineHeight={s(76)}
          style={{ writingDirection: 'rtl', fontWeight: '600' }}
        >
          הֶבֶל
        </Text>
        <Text
          title
          fontSize={s(28)}
          lineHeight={s(34)}
          style={{ fontFamily: 'Literata Book', fontStyle: 'italic' }}
        >
          {t(definition.transliterationKey)}
        </Text>
      </VStack>

      <Box height={1} bg="border" mt={s(18)} mb={s(18)} />

      <HStack alignItems="center" gap={s(14)} overflow="visible">
        <Pressable
          accessibilityRole={isAction ? 'button' : undefined}
          accessibilityLabel={isAction ? t('playground.sceneThree.openStrong') : undefined}
          disabled={!isAction}
          hitSlop={s(4)}
          onPress={isAction ? onActionPress : undefined}
          style={({ pressed }) => ({
            overflow: 'visible',
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <HStack
            minHeight={s(34)}
            borderRadius={s(12)}
            px={s(10)}
            alignItems="center"
            bg={isAction ? 'primary' : 'lightPrimary'}
            lightShadow
            overflow="visible"
          >
            <Text color={isAction ? 'reverse' : 'primary'} bold fontSize={s(14)}>
              H{definition.code}
            </Text>
          </HStack>
        </Pressable>
        <Text title fontSize={s(28)} lineHeight={s(32)}>
          {t(definition.titleKey)}
        </Text>
      </HStack>
      <Text color="tertiary" fontSize={s(15)} lineHeight={s(20)} mt={s(10)} bold>
        {t(definition.definitionKey)}
      </Text>
      <Box mt="auto">
        <Text color="tertiary" fontSize={s(9)} bold style={{ letterSpacing: s(2.2) }}>
          {t(definition.typeKey)}
        </Text>
      </Box>
    </Box>
  )
}

const createStrongHorizontalStackAnimation = (
  moveSize: number,
  stackInterval: number
): TAnimationStyle => {
  return rawValue => {
    'worklet'

    const shownCardCount = 2
    const rearCardCount = shownCardCount - 1
    const page = Math.floor(Math.abs(rawValue))
    const diff = Math.abs(rawValue) % 1
    const easedDiff = diff < 0.5 ? 4 * diff * diff * diff : 1 - (-2 * diff + 2) ** 3 / 2
    const value = rawValue < 0 ? -(page + easedDiff) : page + easedDiff
    const inputRange: [number, number, number] = [-1, 0, rearCardCount]

    const zIndex =
      Math.floor(
        interpolate(
          value,
          [-1.5, -1, -1 + Number.MIN_VALUE, 0, rearCardCount],
          [Number.MIN_VALUE, rearCardCount, rearCardCount, rearCardCount - 1, -1]
        ) * 10000
      ) / 100

    return {
      zIndex: Math.round(zIndex),
      opacity: interpolate(value, [-1, 0, rearCardCount], [0, 1, 0.88], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            value,
            inputRange,
            [-moveSize, 0, rearCardCount * stackInterval],
            Extrapolation.CLAMP
          ),
        },
        {
          translateY: interpolate(
            value,
            inputRange,
            [-20, 0, rearCardCount * 8],
            Extrapolation.CLAMP
          ),
        },
        { scale: interpolate(value, inputRange, [1, 1, 0.92], Extrapolation.CLAMP) },
        {
          rotateZ: `${interpolate(value, inputRange, [-7, 0, 0], Extrapolation.CLAMP)}deg`,
        },
      ],
    }
  }
}

type StrongCardStackProps = {
  activeIndex: StrongCardIndex
  carouselProgress: SharedValue<number>
  metrics: OnboardingStageMetrics
  onIndexChange: (index: StrongCardIndex) => void
  onStrongPress: () => void
  reduceMotion: boolean
  t: TFunction
}

const StrongCardStack = ({
  activeIndex,
  carouselProgress,
  metrics,
  onIndexChange,
  onStrongPress,
  t,
}: StrongCardStackProps) => {
  const cardWidth = metrics.s(272)
  const cardHeight = metrics.s(344)
  const horizontalStackAnimation = createStrongHorizontalStackAnimation(
    metrics.s(300),
    metrics.s(20)
  )

  return (
    <Carousel
      loop
      autoFillData
      defaultIndex={activeIndex}
      data={[...STRONG_DEFINITIONS]}
      windowSize={3}
      itemWidth={cardWidth}
      itemHeight={cardHeight}
      customConfig={{ type: 'positive', viewCount: 2 }}
      customAnimation={horizontalStackAnimation}
      onProgressChange={carouselProgress}
      withAnimation={{ type: 'spring', config: {} }}
      onConfigurePanGesture={gesture => {
        gesture.activeOffsetX([-10, 10])
      }}
      style={{ width: cardWidth, height: cardHeight, overflow: 'visible' }}
      contentContainerStyle={{ overflow: 'visible' }}
      onSnapToItem={index => onIndexChange(index === 0 ? 0 : 1)}
      renderItem={({ item }) => (
        <StrongDefinitionCard
          definition={item}
          metrics={metrics}
          onActionPress={onStrongPress}
          t={t}
        />
      )}
    />
  )
}

const StrongPagination = ({
  carouselProgress,
  metrics,
}: {
  carouselProgress: SharedValue<number>
  metrics: OnboardingStageMetrics
}) => {
  const theme = useTheme()
  const dotSize = metrics.s(9)
  const activeDotSize = metrics.s(10)

  return (
    <Pagination.Custom
      progress={carouselProgress}
      data={[...STRONG_DEFINITIONS]}
      size={dotSize}
      containerStyle={{ gap: metrics.s(8) }}
      dotStyle={{ borderRadius: dotSize / 2, backgroundColor: theme.colors.lightPrimary }}
      activeDotStyle={{
        width: activeDotSize,
        height: activeDotSize,
        borderRadius: activeDotSize / 2,
        backgroundColor: theme.colors.primary,
      }}
      carouselName="Strong"
    />
  )
}

type SceneThreeBackgroundProps = {
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
}

const SceneThreeBackground = ({ metrics, reduceMotion }: SceneThreeBackgroundProps) => (
  <SceneDecorativePluses metrics={metrics} reduceMotion={reduceMotion} scene="three" />
)

type CreateSceneThreeStrongProps = SceneThreeBackgroundProps & {
  activeIndex: StrongCardIndex
  carouselProgress: SharedValue<number>
  highlightColor: HighlightColor
  onIndexChange: (index: StrongCardIndex) => void
  onStrongPress: () => void
  t: TFunction
}

export const createSceneThreeStrong = ({
  activeIndex,
  carouselProgress,
  highlightColor,
  metrics,
  onIndexChange,
  onStrongPress,
  reduceMotion,
  t,
}: CreateSceneThreeStrongProps) => (
  <Scene id="scene-three">
    <SceneThreeBackground metrics={metrics} reduceMotion={reduceMotion} />
    <Scene.Node
      id="scene-background"
      layout="resize"
      frame={{ x: 66, y: 30, width: 280, height: 290, opacity: 0.5, zIndex: 0 }}
      pointerEvents="none"
    >
      <SceneBackgroundShape borderRadius={metrics.s(145)} reduceMotion={reduceMotion} />
    </Scene.Node>
    <Scene.Node
      id="verse-card"
      layout="scale"
      frame={{
        x: -145,
        y: 117,
        width: 382,
        height: 294,
        scale: 0.42,
        rotation: 4,
        opacity: 0.5,
        zIndex: 1,
        anchors: { highlightedWord: { x: 0.43, y: 0.52 } },
      }}
      draggable
      dragFriction={0.1}
      pointerEvents="none"
    >
      <VerseCard
        mode="small"
        reduceMotion={reduceMotion}
        highlightColor={highlightColor}
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="strong-stack"
      frame={{ x: 70, y: 35, width: 272, height: 344, zIndex: 6 }}
      enterDelay={180}
      enterFrom={{ x: 28, y: 28 }}
      exitTo={{ x: 28, y: 28 }}
    >
      <StrongCardStack
        activeIndex={activeIndex}
        carouselProgress={carouselProgress}
        metrics={metrics}
        onIndexChange={onIndexChange}
        onStrongPress={onStrongPress}
        reduceMotion={reduceMotion}
        t={t}
      />
    </Scene.Node>
    <Scene.Node
      id="strong-pagination"
      frame={{ x: 145, y: 425, width: 60, height: 16, zIndex: 7 }}
      enterDelay={320}
      enterFrom={{ x: 0, y: 10 }}
      exitTo={{ x: 0, y: 10 }}
      pointerEvents="none"
    >
      <StrongPagination carouselProgress={carouselProgress} metrics={metrics} />
    </Scene.Node>
  </Scene>
)

export type { StrongCardIndex }
