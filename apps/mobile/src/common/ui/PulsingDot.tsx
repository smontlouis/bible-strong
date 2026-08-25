import { useTheme } from '@emotion/react'
import Animated from 'react-native-reanimated'
import { ViewStyle } from 'react-native'

type PulsingDotProps = {
  size?: number
  color?: string
  style?: ViewStyle
}

const PulsingDot = ({ size = 10, color, style }: PulsingDotProps) => {
  const theme = useTheme()
  const dotColor = color || theme.colors.success

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: dotColor,
          animationName: {
            '0%': { transform: [{ scale: 1 }], opacity: 1 },
            '50%': { transform: [{ scale: 1.1 }], opacity: 0.8 },
            '100%': { transform: [{ scale: 1 }], opacity: 1 },
          },
          animationDuration: 1000,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-out',
        },
        style,
      ]}
    />
  )
}

export default PulsingDot
