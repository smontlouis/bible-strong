import { Pressable } from 'react-native'
import Box from '~common/ui/Box'
import { AnimatedText } from '~common/ui/Text'
import type { TabButtonProps } from '../types'

const TabButton = ({ label, isActive, onPress }: TabButtonProps) => (
  <Pressable onPress={onPress} style={{ flex: 1, zIndex: 1 }}>
    <Box py={10}>
      <AnimatedText
        fontSize={14}
        fontWeight={isActive ? '600' : '400'}
        color={isActive ? 'primary' : 'default'}
        textAlign="center"
        style={{
          transitionProperty: 'color',
          transitionDuration: 150,
        }}
      >
        {label}
      </AnimatedText>
    </Box>
  </Pressable>
)

export default TabButton
