import React from 'react'
import { useTranslation } from 'react-i18next'
import { BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack, VStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { SubSku } from '~helpers/useInAppPurchases'
import useLanguage from '~helpers/useLanguage'

export interface SubscriptionDetailsProps {
  sub: SubSku
}

const CheckItem = ({
  children,
  detail,
  ...props
}: { children: string; detail?: React.ReactNode } & BoxProps) => (
  <HStack {...props}>
    <FeatherIcon name="check" size={20} color="success" />
    <Text>{children}</Text>
    {detail}
  </HStack>
)

const useSubDetail = (sub: SubSku) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const subDetails: {
    sku: string
    title: string
    description: string
    details: {
      label: string
      status?: string
    }[]
  }[] = [
    {
      sku: 'com.smontlouis.biblestrong.onemonth.min',
      title: t('premium.onemonth.min.title'),
      description: t('premium.onemonth.min.description'),
      details: isFR
        ? [
            { label: t('premium.onemonth.min.detail1') },
            { label: t('premium.onemonth.min.detail2') },
            { label: t('premium.onemonth.min.detail3') },
            { label: t('premium.onemonth.min.detail4') },
          ]
        : [
            { label: t('premium.onemonth.min.detail1') },
            { label: t('premium.onemonth.min.detail2') },
            { label: t('premium.onemonth.min.detail4') },
          ],
    },
    {
      sku: 'com.smontlouis.biblestrong.onemonth',
      title: t('premium.onemonth.title'),
      description: t('premium.onemonth.description'),
      details: [
        { label: t('premium.onemonth.detail1') },
        { label: t('premium.onemonth.detail2') },
        { label: t('premium.onemonth.detail3') },
        { label: t('premium.onemonth.detail4'), status: t('premium.coming') },
        { label: t('premium.onemonth.detail5'), status: t('premium.coming') },
        { label: t('premium.onemonth.detail6'), status: t('premium.coming') },
        { label: t('premium.lotMore') },
      ],
    },
    {
      sku: 'com.smontlouis.biblestrong.onemonth.max',
      title: t('premium.onemonth.max.title'),
      description: t('premium.onemonth.max.description'),
      details: [
        { label: t('premium.onemonth.max.detail1') },
        {
          label: t('premium.onemonth.max.detail2'),
          status: t('premium.coming'),
        },
        {
          label: t('premium.onemonth.max.detail3'),
          status: t('premium.coming'),
        },
        { label: t('premium.lotMore') },
      ],
    },
  ]

  return subDetails.find(subDetail => subDetail.sku === sub)
}

const SubscriptionDetails = ({ sub }: SubscriptionDetailsProps) => {
  const subDetail = useSubDetail(sub)

  return (
    <VStack
      m={20}
      borderRadius={20}
      p={20}
      bg="lightGrey"
      borderColor="lightPrimary"
      borderWidth={3}
    >
      <Text title fontSize={20}>
        {subDetail?.title}
      </Text>
      <Text>{subDetail?.description}</Text>
      <VStack spacing={1 / 2}>
        {subDetail?.details.map(detail => (
          <CheckItem
            key={detail.label}
            detail={
              detail.status ? (
                <Text fontSize={12} color="quart">
                  ({detail.status})
                </Text>
              ) : (
                undefined
              )
            }
          >
            {detail.label}
          </CheckItem>
        ))}
      </VStack>
    </VStack>
  )
}

export default SubscriptionDetails
