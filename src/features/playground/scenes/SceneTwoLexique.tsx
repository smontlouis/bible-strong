import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import { Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Line } from 'react-native-svg'

import Box, { AnimatedBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'

type NodeCardProps = {
  label: string
  icon: ComponentProps<typeof Feather>['name']
  x: number
  y: number
  width: number
  height?: number
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  delay: number
  active?: boolean
  iconSize?: number
  fontSize?: number
  onPress?: () => void
}

const NodeCard = ({
  label,
  icon,
  x,
  y,
  width,
  height = 47,
  metrics,
  reduceMotion,
  delay,
  active = false,
  iconSize,
  fontSize,
  onPress,
}: NodeCardProps) => {
  const theme = useTheme()
  const s = metrics.s
  const resolvedIconSize = iconSize ?? (active ? 30 : 14)
  const resolvedFontSize = fontSize ?? (active ? 16 : 8)

  const card = (
    <AnimatedBox
      position={onPress ? 'relative' : 'absolute'}
      left={onPress ? undefined : s(x)}
      top={onPress ? undefined : s(y)}
      width={s(width)}
      height={s(height)}
      bg="reverse"
      borderRadius={active ? s(17) : s(12)}
      borderWidth={active ? s(2) : 0}
      borderColor={active ? 'primary' : undefined}
      lightShadow
      entering={reduceMotion ? undefined : FadeInDown.duration(active ? 520 : 430).delay(delay)}
      center
    >
      <HStack alignItems="center" gap={s(active ? 5 : 6)} px={s(active ? 16 : 10)}>
        <Feather name={icon} size={s(resolvedIconSize)} color={theme.colors.primary} />
        <Text title={active} bold={!active} fontSize={s(resolvedFontSize)} numberOfLines={1}>
          {label}
        </Text>
      </HStack>
    </AnimatedBox>
  )

  if (!onPress) return card

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        left: s(x),
        top: s(y),
        width: s(width),
        height: s(height),
        opacity: pressed ? 0.82 : 1,
      })}
    >
      {card}
    </Pressable>
  )
}

type SceneTwoLexiqueProps = {
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
}

const SceneTwoLexique = ({ metrics, reduceMotion }: SceneTwoLexiqueProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const s = metrics.s

  return (
    <Box flex width="100%" overflow="visible">
      <AnimatedBox
        position="absolute"
        left={s(10)}
        top={s(24)}
        width={s(330)}
        height={s(430)}
        borderRadius={s(28)}
        bg="lightPrimary"
        opacity={0.62}
        entering={reduceMotion ? undefined : FadeInDown.duration(520)}
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: metrics.width,
          height: metrics.height,
        }}
      >
        <Svg width={metrics.width} height={metrics.height}>
          <Line
            x1={s(126)}
            y1={s(344)}
            x2={s(65)}
            y2={s(62)}
            stroke={theme.colors.primary}
            strokeOpacity={0.23}
            strokeWidth={s(1.4)}
          />
          <Line
            x1={s(150)}
            y1={s(340)}
            x2={s(276)}
            y2={s(46)}
            stroke={theme.colors.primary}
            strokeOpacity={0.23}
            strokeWidth={s(1.4)}
          />
          <Line
            x1={s(185)}
            y1={s(350)}
            x2={s(269)}
            y2={s(256)}
            stroke={theme.colors.primary}
            strokeOpacity={0.23}
            strokeWidth={s(1.4)}
          />
          <Line
            x1={s(195)}
            y1={s(365)}
            x2={s(304)}
            y2={s(316)}
            stroke={theme.colors.primary}
            strokeOpacity={0.23}
            strokeWidth={s(1.4)}
          />
          <Line
            x1={s(112)}
            y1={s(382)}
            x2={s(276)}
            y2={s(404)}
            stroke={theme.colors.primary}
            strokeOpacity={0.23}
            strokeWidth={s(1.4)}
          />
          <Line
            x1={s(136)}
            y1={s(304)}
            x2={s(197)}
            y2={s(203)}
            stroke={theme.colors.primary}
            strokeOpacity={0.8}
            strokeWidth={s(2)}
          />
        </Svg>
      </Animated.View>

      <NodeCard
        label={t('playground.sceneTwo.dictionary')}
        icon="book-open"
        x={16}
        y={62}
        width={98}
        metrics={metrics}
        reduceMotion={reduceMotion}
        delay={100}
      />
      <NodeCard
        label={t('playground.sceneTwo.references')}
        icon="git-branch"
        x={226}
        y={46}
        width={100}
        metrics={metrics}
        reduceMotion={reduceMotion}
        delay={160}
      />
      <NodeCard
        label={t('playground.sceneTwo.lexique')}
        icon="book"
        x={118}
        y={131}
        width={158}
        height={72}
        metrics={metrics}
        reduceMotion={reduceMotion}
        delay={40}
        active
        onPress={() => undefined}
      />
      <NodeCard
        label={t('playground.sceneTwo.comments')}
        icon="message-square"
        x={212}
        y={256}
        width={114}
        metrics={metrics}
        reduceMotion={reduceMotion}
        delay={250}
      />
      <NodeCard
        label={t('playground.sceneTwo.themes')}
        icon="tag"
        x={254}
        y={316}
        width={100}
        metrics={metrics}
        reduceMotion={reduceMotion}
        delay={310}
      />
      <NodeCard
        label={t('playground.sceneTwo.translations')}
        icon="globe"
        x={213}
        y={380}
        width={126}
        metrics={metrics}
        reduceMotion={reduceMotion}
        delay={370}
      />

      <AnimatedBox
        position="absolute"
        left={s(30)}
        top={s(40)}
        entering={reduceMotion ? undefined : FadeInUp.duration(420).delay(260)}
      >
        <Text color="secondary" fontSize={s(18)} bold>
          +
        </Text>
      </AnimatedBox>
      <AnimatedBox
        position="absolute"
        left={s(308)}
        top={s(118)}
        entering={reduceMotion ? undefined : FadeInUp.duration(420).delay(420)}
      >
        <Text color="primary" fontSize={s(13)} bold>
          +
        </Text>
      </AnimatedBox>
      <AnimatedBox
        position="absolute"
        left={s(194)}
        top={s(423)}
        entering={reduceMotion ? undefined : FadeInUp.duration(420).delay(500)}
      >
        <Text color="primary" fontSize={s(14)} bold>
          +
        </Text>
      </AnimatedBox>
    </Box>
  )
}

export default SceneTwoLexique
