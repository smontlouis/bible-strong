import { Feather } from '@expo/vector-icons'
import { useTheme } from '~themes/ThemeProvider'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../OnboardingStage'
type NoteCardProps = {
  children: ReactNode
  metrics: OnboardingStageMetrics
  t: TFunction
  variant?: 'small' | 'default'
}

const NoteCard = ({ children, metrics, t, variant = 'default' }: NoteCardProps) => {
  const theme = useTheme()
  const s = metrics.s

  return (
    <VStack
      className="border-continuous overflow-visible flex-[1]"
      style={[
        {
          paddingTop: variant === 'small' ? s(12) : s(17),
          paddingBottom: variant === 'small' ? s(12) : s(14),
          paddingHorizontal: variant === 'small' ? s(12) : s(18),
          borderRadius: s(12),
        },
        {
          backgroundColor: '#FFF8E8',
          boxShadow: '0 7px 16px rgba(59,92,204,0.15)',
        },
      ]}
    >
      {variant === 'default' && (
        <Box
          className="overflow-hidden border-continuous absolute"
          style={[
            { width: s(96), height: s(14), top: s(-7), left: s(46), borderRadius: s(3) },
            { backgroundColor: 'rgba(253,203,110,0.62)', transform: [{ rotate: '2deg' }] },
          ]}
        />
      )}

      <HStack className="overflow-hidden border-continuous justify-between items-center">
        <HStack className="overflow-hidden border-continuous items-center" style={{ gap: s(5) }}>
          <Feather name="file-plus" size={s(11)} color={theme.colors.quart} />
          <Text
            className="text-quart font-bold"
            style={[{ fontSize: s(8.5) || 16 }, { letterSpacing: s(1) }]}
          >
            {t('onboarding.abel.sceneFive.noteLabel')}
          </Text>
        </HStack>
        <Text className="text-[#FF6B6B]" style={{ fontSize: s(14) || 16 }}>
          ✦
        </Text>
      </HStack>
      {children}
    </VStack>
  )
}

export default NoteCard
