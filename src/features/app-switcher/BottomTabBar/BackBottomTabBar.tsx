import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../utils/constants'

type BackBottomTabBarProps = {
  onClose: () => void
  direction: 'left' | 'right'
}

const BackBottomTabBar = ({ onClose, direction }: BackBottomTabBarProps) => {
  return (
    <Box
      row
      pb={useSafeAreaInsets().bottom}
      bg="reverse"
      px={20}
      alignItems="center"
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      borderTopWidth={1}
      borderColor="border"
      justifyContent={direction === 'left' ? 'flex-start' : 'flex-end'}
    >
      <TouchableBox center size={TAB_ICON_SIZE} onPress={onClose}>
        <FeatherIcon
          name={direction === 'left' ? 'arrow-left' : 'arrow-right'}
          size={23}
          color="tertiary"
        />
      </TouchableBox>
    </Box>
  )
}

export default BackBottomTabBar
