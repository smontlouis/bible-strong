import type { TFunction } from 'i18next'
import { type SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'

type SourceCardProps = {
  label: string
  markerColor: string
  meta?: string
  metrics: OnboardingStageMetrics
  shakeRotation?: SharedValue<number>
  title: string
  titleItalic?: boolean
  variant?: 'small' | 'large'
}

export const SourceCard = ({
  label,
  markerColor,
  meta,
  metrics,
  shakeRotation,
  title,
  titleItalic = false,
  variant = 'large',
}: SourceCardProps) => {
  const s = metrics.s
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shakeRotation?.get() ?? 0}deg` }],
  }))

  return (
    <AnimatedBox flex overflow="visible" style={shakeStyle}>
      <VStack
        flex
        bg="reverse"
        borderRadius={s(16)}
        px={s(11)}
        py={s(10)}
        gap={s(5)}
        style={{ boxShadow: '0 4px 12px rgba(59,92,204,0.13)' }}
      >
        <HStack justifyContent="space-between" alignItems="center">
          <Text color="primary" bold fontSize={s(8)} style={{ letterSpacing: s(0.6) }}>
            {label}
          </Text>
          <Box size={s(7)} borderRadius={s(3.5)} style={{ backgroundColor: markerColor }} />
        </HStack>
        <Text
          title
          fontSize={variant === 'small' ? s(12) : s(16)}
          lineHeight={variant === 'small' ? s(18) : s(21)}
          bold={!titleItalic}
          style={{
            fontFamily: 'Literata Book',
            fontStyle: titleItalic ? 'italic' : 'normal',
          }}
        >
          {title}
        </Text>
        {meta ? (
          <Text color="tertiary" bold fontSize={s(9.5)} lineHeight={s(12)}>
            {meta}
          </Text>
        ) : null}
      </VStack>
    </AnimatedBox>
  )
}

type ShakableSourceCardProps = {
  metrics: OnboardingStageMetrics
  shakeRotation?: SharedValue<number>
  t: TFunction
}

export const AbelSourceCard = ({ metrics, shakeRotation, t }: ShakableSourceCardProps) => (
  <SourceCard
    label={t('playground.sceneFive.abelLabel')}
    markerColor="#FF6B6B"
    meta={t('playground.sceneFive.abelMeta')}
    metrics={metrics}
    shakeRotation={shakeRotation}
    title="Abel"
    variant="small"
  />
)

export const HevelSourceCard = ({ metrics, shakeRotation, t }: ShakableSourceCardProps) => (
  <SourceCard
    label={t('playground.sceneFive.hevelLabel')}
    markerColor="#FDCB6E"
    meta={t('playground.sceneFive.hevelMeta')}
    metrics={metrics}
    shakeRotation={shakeRotation}
    title="hevel"
    titleItalic
    variant="small"
  />
)

type GenesisSourceCardProps = {
  metrics: OnboardingStageMetrics
  shakeRotation: SharedValue<number>
  t: TFunction
}

const GenesisSourceCard = ({ metrics, shakeRotation, t }: GenesisSourceCardProps) => (
  <SourceCard
    label={t('playground.sceneFive.genesisLabel')}
    markerColor="#5983F0"
    metrics={metrics}
    shakeRotation={shakeRotation}
    title={t('playground.sceneFive.genesisTitle')}
  />
)

export default GenesisSourceCard
