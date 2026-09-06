import React from 'react'
import { StyleSheet } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
import Color from 'color'
import Animated, { cubicBezier } from 'react-native-reanimated'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { Theme } from '~themes'
interface Props {
  children: React.ReactNode
}

const PauseText = ({ children }: Props) => {
  const theme: Theme = useTheme()
  const color = Color(theme.colors.primary)

  return (
    <Box className="overflow-hidden border-continuous items-center justify-center mt-[60px] mb-[120px]">
      <Box className="overflow-hidden border-continuous h-[100px] w-[100px] mb-[10px]">
        <Box
          className="overflow-hidden border-continuous items-center justify-center"
          style={StyleSheet.absoluteFill}
        >
          <Animated.View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: color.alpha(0.3).string(),
              animationName: {
                from: { transform: [{ scale: 1.1 }] },
                to: { transform: [{ scale: 2.6 }] },
              },
              animationDuration: '2.3s',
              animationTimingFunction: 'ease-in-out',
              animationDirection: 'alternate',
              animationIterationCount: 'infinite',
            }}
          />
        </Box>
        <Box
          className="overflow-hidden border-continuous items-center justify-center"
          style={StyleSheet.absoluteFill}
        >
          <Animated.View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: color.alpha(0.5).string(),
              animationName: {
                from: { transform: [{ scale: 1 }] },
                to: { transform: [{ scale: 2.04 }] },
              },
              animationDuration: '2.3s',
              animationTimingFunction: cubicBezier(0.45, 0.05, 0.4, 0.95),
              animationDirection: 'alternate',
              animationIterationCount: 'infinite',
            }}
          />
        </Box>
      </Box>
      <Paragraph className="text-center text-grey" scale={-2}>
        {children}
      </Paragraph>
    </Box>
  )
}

export default PauseText
