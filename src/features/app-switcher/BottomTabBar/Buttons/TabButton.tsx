import React from 'react'
import { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { TAB_ICON_SIZE } from '../../utils/constants'
import useTabButtonPress from './useTabButtonPress'

const TabButton = () => {
  const { onPress, tabsCount, iconStyle, groupColor } = useTabButtonPress()
  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <AnimatedBox
        size={20}
        borderWidth={2}
        borderColor={groupColor || 'tertiary'}
        bg={groupColor}
        borderRadius={5}
        center
        style={iconStyle}
      >
        <Text fontSize={12} color={groupColor ? 'black' : 'tertiary'} lineHeight={15}>
          {tabsCount > 100 ? ':)' : tabsCount}
        </Text>
      </AnimatedBox>
    </TouchableBox>
  )
}

export default TabButton
