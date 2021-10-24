import React from 'react'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const SwitchButton = ({
  children,
  onPress,
  isSelected,
}: {
  children: React.ReactNode
  onPress: () => void
  isSelected?: boolean
}) => (
  <LinkBox onPress={onPress}>
    <Box
      bg={isSelected ? 'primary' : 'lightPrimary'}
      px={10}
      py={5}
      lightShadow
      borderRadius={20}
      my={10}
    >
      <Text
        color={isSelected ? 'reverse' : 'primary'}
        textAlign="center"
        fontSize={11}
      >
        {children}
      </Text>
    </Box>
  </LinkBox>
)

export default SwitchButton
