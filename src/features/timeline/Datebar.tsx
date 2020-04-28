import React from 'react'
import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { offset } from './constants'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import Animated from 'react-native-reanimated'

const Datebar = ({
  width,
  x,
  startYear,
  endYear,
  interval,
  color,
}: {
  x: Animated.Value<number>
  width: number
  startYear: number
  endYear: number
  interval: number
  color: string
}) => {
  const [values, setValues] = React.useState<number[]>([])

  React.useEffect(() => {
    const array = []
    for (let i = startYear; i < endYear; i = i + interval) {
      array.push(i)
    }
    setValues(array)
  }, [startYear, endYear, interval])

  return (
    <>
      <AnimatedBox
        row
        pos="absolute"
        l={0}
        b={getBottomSpace()}
        width={width}
        height={25}
        paddingLeft={offset}
        style={{ transform: [{ translateX: x }] }}
        bg="reverse"
        lightShadow
      >
        {values.map(value => (
          <Box
            key={value}
            width={100}
            left={-50}
            alignItems="center"
            justifyContent="flex-end"
          >
            <Box p={5} borderRadius={3} mb={3}>
              <Text color={color} title fontWeight="bold" fontSize={10}>
                {Math.abs(value)}
              </Text>
            </Box>
          </Box>
        ))}
      </AnimatedBox>
    </>
  )
}

export default Datebar
