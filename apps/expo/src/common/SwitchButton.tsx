import { twMerge } from '~common/ui/classNames'

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
}) => {
  return (
    <LinkBox onPress={onPress}>
      <Box
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge(
            isSelected ? 'bg-primary' : 'bg-light-primary',
            'overflow-hidden border-continuous px-[10px] py-[5px] rounded-[20px] my-[10px]'
          )
        )}
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Text
          className={twMerge(
            isSelected ? 'text-reverse' : 'text-primary',
            'text-center text-[11px]'
          )}
        >
          {children}
        </Text>
      </Box>
    </LinkBox>
  )
}

export default SwitchButton
