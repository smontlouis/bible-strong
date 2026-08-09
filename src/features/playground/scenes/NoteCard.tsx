import { Feather } from '@expo/vector-icons'
import { useTheme } from '@emotion/react'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'

import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'

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
      flex
      borderRadius={s(12)}
      px={variant === 'small' ? s(12) : s(18)}
      pt={variant === 'small' ? s(12) : s(17)}
      pb={variant === 'small' ? s(12) : s(14)}
      overflow="visible"
      style={{
        backgroundColor: '#FFF8E8',
        boxShadow: '0 7px 16px rgba(59,92,204,0.15)',
      }}
    >
      {variant === 'default' && (
        <Box
          position="absolute"
          left={s(46)}
          top={s(-7)}
          width={s(96)}
          height={s(14)}
          borderRadius={s(3)}
          style={{ backgroundColor: 'rgba(253,203,110,0.62)', transform: [{ rotate: '2deg' }] }}
        />
      )}

      <HStack justifyContent="space-between" alignItems="center">
        <HStack alignItems="center" gap={s(5)}>
          <Feather name="file-plus" size={s(11)} color={theme.colors.quart} />
          <Text color="quart" bold fontSize={s(8.5)} style={{ letterSpacing: s(1) }}>
            {t('playground.sceneFive.noteLabel')}
          </Text>
        </HStack>
        <Text color="#FF6B6B" fontSize={s(14)}>
          ✦
        </Text>
      </HStack>
      {children}
    </VStack>
  )
}

export default NoteCard
