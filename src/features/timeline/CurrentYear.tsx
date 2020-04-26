import React from 'react'
import Box from '~common/ui/Box'
import { offset } from './constants'
import { ReText } from 'react-native-redash'
import Animated from 'react-native-reanimated'

const CurrentYear = ({ year }: { year: Animated.Node<string> }) => {
  return (
    <>
      <Box
        pos="absolute"
        b={0}
        l={offset}
        w={1}
        h="100%"
        bg="primary"
        opacity={0.3}
      />
      <Box
        pos="absolute"
        l={offset}
        b={0}
        bg="primary"
        p={10}
        width={120}
        transform={[{ translateX: -(120 / 2) }]}
        center
        rounded
      >
        <ReText text={year} style={{ color: 'black' }} />
      </Box>
    </>
  )
}

export default CurrentYear
