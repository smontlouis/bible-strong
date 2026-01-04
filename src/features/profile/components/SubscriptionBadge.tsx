import styled from '@emotion/native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import * as Icon from '@expo/vector-icons'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'

const SubscriptionBadge = () => {
  const { t } = useTranslation()
  const subscription = useSelector((state: RootState) => state.user.subscription)

  if (!subscription) return null

  return (
    <HStack gap={10} marginTop={5}>
      <Badge>
        <Icon.AntDesign name="star" size={14} color="#F59E0B" />
        <Text fontSize={12} color="grey" marginLeft={5}>
          {t('profile.premium')}
        </Text>
      </Badge>
    </HStack>
  )
}

const Badge = styled(Box)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 15,
  borderWidth: 1,
  borderColor: '#F59E0B',
  backgroundColor: theme.colors.reverse,
}))

export default SubscriptionBadge
