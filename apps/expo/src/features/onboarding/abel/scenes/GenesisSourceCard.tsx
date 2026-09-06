import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { TFunction } from 'i18next'
import { type SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../OnboardingStage'
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
  const stylingTheme = useStylingTheme()

  const s = metrics.s
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shakeRotation?.get() ?? 0}deg` }],
  }))

  return (
    <AnimatedBox className="border-continuous overflow-visible flex-[1]" style={shakeStyle}>
      <VStack
        className="overflow-hidden border-continuous flex-[1] bg-reverse"
        style={[
          { paddingHorizontal: s(11), paddingVertical: s(10), borderRadius: s(16), gap: s(5) },
          { boxShadow: '0 4px 12px rgba(59,92,204,0.13)' },
        ]}
      >
        <HStack className="overflow-hidden border-continuous justify-between items-center">
          <Text
            className="text-primary font-bold"
            style={[{ fontSize: s(8) || 16 }, { letterSpacing: s(0.6) }]}
          >
            {label}
          </Text>
          <Box
            className="overflow-hidden border-continuous"
            style={[
              { borderRadius: s(3.5), ...(s(7) ? { width: s(7), height: s(7) } : {}) },
              { backgroundColor: markerColor },
            ]}
          />
        </HStack>
        <Text
          style={[
            {
              fontSize: (variant === 'small' ? s(12) : s(16)) || 16,
              lineHeight: variant === 'small' ? s(18) : s(21),
              fontWeight: !titleItalic ? 'bold' : undefined,
              fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
            },
            {
              fontFamily: 'Literata Book',
              fontStyle: titleItalic ? 'italic' : 'normal',
            },
          ]}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            className="text-tertiary font-bold"
            style={{ fontSize: s(9.5) || 16, lineHeight: s(12) }}
          >
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
    label={t('onboarding.abel.sceneFive.abelLabel')}
    markerColor="#FF6B6B"
    meta={t('onboarding.abel.sceneFive.abelMeta')}
    metrics={metrics}
    shakeRotation={shakeRotation}
    title="Abel"
    variant="small"
  />
)

export const HevelSourceCard = ({ metrics, shakeRotation, t }: ShakableSourceCardProps) => (
  <SourceCard
    label={t('onboarding.abel.sceneFive.hevelLabel')}
    markerColor="#FDCB6E"
    meta={t('onboarding.abel.sceneFive.hevelMeta')}
    metrics={metrics}
    shakeRotation={shakeRotation}
    title={t('onboarding.abel.sceneThree.commonTitle')}
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
    label={t('onboarding.abel.sceneFive.genesisLabel')}
    markerColor="#5983F0"
    metrics={metrics}
    shakeRotation={shakeRotation}
    title={t('onboarding.abel.sceneFive.genesisTitle')}
  />
)

export default GenesisSourceCard
