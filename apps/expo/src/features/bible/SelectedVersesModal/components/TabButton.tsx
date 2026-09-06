import { twMerge } from '~common/ui/classNames'

import { Pressable } from 'react-native'
import Box from '~common/ui/Box'
import { AnimatedText } from '~common/ui/Text'
import type { TabButtonProps } from '../types'
const TabButton = ({ label, isActive, onPress }: TabButtonProps) => {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={{ flex: 1, zIndex: 1 }}
    >
      <Box className="overflow-hidden border-continuous py-[10px]">
        <AnimatedText
          className={twMerge(isActive ? 'text-primary' : 'text-default', 'text-[14px] text-center')}
          style={[
            { fontWeight: isActive ? '600' : '400' },
            {
              transitionProperty: 'color',
              transitionDuration: 150,
            },
          ]}
        >
          {label}
        </AnimatedText>
      </Box>
    </Pressable>
  )
}

export default TabButton
