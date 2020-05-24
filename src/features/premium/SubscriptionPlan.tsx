import React from 'react'

import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import { mappingSku } from './PremiumScreen'

export type subVariant = 'normal' | 'secondary' | 'primary'

interface Props {
  productId: string
  discount?: string
  price: string
  isSelected?: boolean
  variant?: subVariant
  onPress: () => void
}

const LinkBox = Box.withComponent(Link)

const SubscriptionPlan = ({
  productId,
  discount,
  price,
  isSelected,
  variant,
  onPress,
}: Props) => {
  return (
    <LinkBox
      py={20}
      px={15}
      bg="reverse"
      borderWidth={4}
      borderColor="reverse"
      rounded
      center
      overflow="visible"
      onPress={onPress}
      {...(isSelected && { borderColor: 'primary' })}
    >
      {variant !== 'normal' && (
        <Box
          position="absolute"
          top={-10}
          right={0}
          left={0}
          center
          overflow="visible"
        >
          <Box
            bg={variant === 'primary' ? 'primary' : 'tertiary'}
            px={8}
            py={3}
            borderRadius={20}
          >
            <Text color="reverse" fontSize={11}>
              {discount} en moins
            </Text>
          </Box>
        </Box>
      )}
      <Text fontSize={18} bold>
        {price}
      </Text>
      <Text>{mappingSku[productId]?.period}</Text>
    </LinkBox>
  )
}

export default SubscriptionPlan
