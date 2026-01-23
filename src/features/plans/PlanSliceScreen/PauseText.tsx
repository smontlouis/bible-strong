import React from 'react'
import { StyleSheet } from 'react-native'
import { useTheme } from '@emotion/react'
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
    <Box center marginTop={60} marginBottom={120}>
      <Box height={100} width={100} marginBottom={10}>
        <Box style={StyleSheet.absoluteFillObject} center>
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
        <Box style={StyleSheet.absoluteFillObject} center>
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
      <Paragraph scale={-2} textAlign="center" color="grey">
        {children}
      </Paragraph>
    </Box>
  )
}

export default PauseText
