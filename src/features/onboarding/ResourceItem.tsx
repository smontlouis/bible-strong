import React from 'react'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack, VStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'

type Props = {
  name: string
  subTitle?: string
  fileSize?: number
  isSelected?: boolean
  isDisabled?: boolean
  onPress?: () => void
}

const DownloadItem = ({
  name,
  subTitle,
  fileSize,
  isSelected,
  isDisabled,
  onPress,
}: Props) => {
  return (
    <TouchableBox
      px={20}
      py={10}
      onPress={isDisabled ? undefined : onPress}
      opacity={isDisabled ? 0.5 : 1}
    >
      <VStack spacing={1 / 2} flex={1}>
        <HStack>
          <Text
            flex
            fontSize={18}
            color={isSelected ? 'primary' : 'default'}
            bold={isSelected}
          >
            {name}
          </Text>
          {fileSize && (
            <Text fontSize={14} color="grey">
              {Math.round(fileSize / 1000000)}Mo
            </Text>
          )}
        </HStack>
        {subTitle && (
          <Text fontSize={14} color="grey">
            {subTitle}
          </Text>
        )}
      </VStack>
      <Box
        marginLeft={30}
        w={25}
        height={25}
        borderRadius={20}
        center
        backgroundColor={isSelected ? 'primary' : 'transparent'}
      >
        <FeatherIcon
          name="check"
          size={14}
          style={{ opacity: isSelected ? 1 : 0.7, top: 1 }}
          color={isSelected ? 'reverse' : 'grey'}
        />
      </Box>
    </TouchableBox>
  )
}

export default DownloadItem
