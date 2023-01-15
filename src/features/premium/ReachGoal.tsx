import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import Link from '~common/Link'
import Box, { BoxProps } from '~common/ui/Box'
import { ProgressBar } from '~common/ui/ProgressBar'
import { HStack, VStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { useDocument, useDocumentData } from 'react-firebase-hooks/firestore'
import { firebaseDb } from '~helpers/firebase'

const Stats = ({
  label,
  value,
  ...props
}: { label: string; value: string } & BoxProps) => (
  <VStack
    spacing={1 / 4}
    borderRadius={8}
    borderColor="lightPrimary"
    borderWidth={1}
    px={16}
    py={12}
    {...props}
  >
    <Text opacity={0.4} bold fontSize={12}>
      {label}
    </Text>
    <Box row alignItems="flex-end">
      <Text fontSize={18} bold>
        {value}
      </Text>
    </Box>
  </VStack>
)

const ReachGoal = () => {
  const { t } = useTranslation()
  const [data, loading, error] = useDocumentData<{
    activeSubscribers: number
    monthlyRecurringRevenue: number
  }>(firebaseDb.doc('stats/iaphub'))

  console.log({ data, loading, error })

  const items = [
    {
      value: 400,
      description: t('premium.earnings.500.description'),
    },
    {
      value: 1500,
      description: t('premium.earnings.1500.description'),
    },
  ]

  return (
    <VStack spacing={3} mt={20} mb={40} px={20}>
      <VStack>
        <Text bold fontSize={18}>
          Quelques chiffres
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
          }}
        >
          <HStack>
            <Stats
              label={t('premium.earnings')}
              value={`€${data?.monthlyRecurringRevenue || '_'}`}
            />
            <Stats
              label={t('Contributeurs')}
              value={data?.activeSubscribers.toString() || '_'}
            />
            <Stats label={t('Utilisateurs mensuels')} value="57k" />
          </HStack>
        </ScrollView>
      </VStack>
      <VStack spacing={1}>
        <Text bold fontSize={18}>
          {t('premium.objectives')}
        </Text>
        <VStack spacing={1}>
          {items.map(({ value, description }, index) => (
            <VStack key={index} spacing={1 / 2}>
              <HStack spacing={0.2} alignItems="flex-end">
                <Text title fontSize={14}>
                  €{value}
                </Text>
                <Text fontSize={14} color="grey">
                  {t('par mois')}
                </Text>
              </HStack>
              <Box>
                <ProgressBar
                  progress={
                    data?.monthlyRecurringRevenue
                      ? data.monthlyRecurringRevenue / value
                      : 0
                  }
                />
              </Box>
              <Text fontSize={14}>{description}</Text>
            </VStack>
          ))}
          <Box>
            <Link route="PremiumMore">
              <Text style={{ textDecorationLine: 'underline' }}>
                {t('premium.learnMore')}
              </Text>
            </Link>
          </Box>
        </VStack>
      </VStack>
    </VStack>
  )
}

export default ReachGoal
