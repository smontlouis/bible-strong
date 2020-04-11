import React from 'react'
import { StyleSheet } from 'react-native'
import * as Animatable from 'react-native-animatable'
import { useTheme } from 'emotion-theming'
import Color from 'color'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import styled from '~styled'
import { Theme } from '~themes'

const Circle = styled.View({
  width: 30,
  height: 30,
  borderRadius: 15,
})

const AnimatableCircle = Animatable.createAnimatableComponent(Circle)

const circleSmall = {
  from: {
    scale: 0.9,
  },
  to: {
    scale: 1.3,
  },
}

const circleMedium = {
  from: {
    scale: 1,
  },
  to: {
    scale: 2.05,
  },
}

const circleBig = {
  from: {
    scale: 1.1,
  },
  to: {
    scale: 2.6,
  },
}

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
          <AnimatableCircle
            duration={2300}
            animation={circleBig}
            easing="ease-in-out-cubic"
            direction="alternate"
            iterationCount="infinite"
            style={{ backgroundColor: color.alpha(0.3).string() }}
          />
        </Box>
        <Box style={StyleSheet.absoluteFillObject} center>
          <AnimatableCircle
            duration={2300}
            animation={circleMedium}
            easing="ease-in-out-cubic"
            direction="alternate"
            iterationCount="infinite"
            style={{ backgroundColor: color.alpha(0.5).string() }}
          />
        </Box>
        <Box style={StyleSheet.absoluteFillObject} center>
          <AnimatableCircle
            duration={2300}
            animation={circleSmall}
            easing="ease-in-out-cubic"
            direction="alternate"
            iterationCount="infinite"
            style={{ backgroundColor: color }}
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
