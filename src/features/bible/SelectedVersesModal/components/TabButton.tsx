import { Pressable } from 'react-native'
import Animated from 'react-native-reanimated'
import Box from '~common/ui/Box'
import type { TabButtonProps } from '../types'

const TabButton = ({ label, isActive, onPress }: TabButtonProps) => (
  <Pressable onPress={onPress} style={{ flex: 1, zIndex: 1 }}>
    <Box py={10}>
      <Animated.Text
        style={{
          fontSize: 14,
          fontWeight: isActive ? '600' : '400',
          textAlign: 'center',
          // @ts-ignore - CSS Transitions for Reanimated 4
          transitionProperty: 'color',
          transitionDuration: 150,
        }}
      >
        {label}
      </Animated.Text>
    </Box>
  </Pressable>
)

export default TabButton
