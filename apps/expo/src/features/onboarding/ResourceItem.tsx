import { twMerge } from '~common/ui/classNames'

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

const DownloadItem = ({ name, subTitle, fileSize, isSelected, isDisabled, onPress }: Props) => {
  return (
    <TouchableBox
      className="overflow-hidden border-continuous px-[20px] py-[10px] flex-row"
      onPress={isDisabled ? undefined : onPress}
      style={{ opacity: isDisabled ? 0.5 : 1 }}
    >
      <VStack className="flex-[1]" spacing={1 / 2}>
        <HStack>
          <Text
            className={twMerge(
              isSelected ? 'text-primary' : 'text-default',
              'flex-[1] text-[18px]'
            )}
            style={{ fontWeight: isSelected ? 'bold' : undefined }}
          >
            {name}
          </Text>
          {fileSize != null && fileSize > 0 && (
            <Text className="text-[14px] text-grey">{Math.round(fileSize / 1000000)}Mo</Text>
          )}
        </HStack>
        {subTitle && <Text className="text-[14px] text-grey">{subTitle}</Text>}
      </VStack>
      <Box
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge(
            isSelected ? 'bg-primary' : 'bg-[transparent]',
            'overflow-hidden border-continuous ml-[30px] w-[25px] h-[25px] rounded-[20px] items-center justify-center'
          )
        )}
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
