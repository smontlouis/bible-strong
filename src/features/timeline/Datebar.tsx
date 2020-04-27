import React from 'react'
import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { offset } from './constants'
import Animated from 'react-native-reanimated'
import { getBottomSpace } from 'react-native-iphone-x-helper'

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
  console.log(startYear, endYear)

  React.useEffect(() => {
    const array = []
    for (let i = startYear; i < endYear; i = i + interval) {
      array.push(i)
    }
    setValues(array)
  }, [startYear, endYear, interval])

  return (
    <AnimatedBox
      row
      pos="absolute"
      l={0}
      b={getBottomSpace()}
      width={width}
      height={50}
      paddingLeft={offset}
      style={{ transform: [{ translateX: x }] }}
    >
      <Box
        lightShadow
        position="absolute"
        left={0}
        right={0}
        bg={color}
        top={24}
        height={3}
      />
      {values.map(value => (
        <Box
          key={value}
          width={100}
          left={-50}
          alignItems="center"
          justifyContent="center"
        >
          <Box lightShadow bg="lightPrimary" p={5} borderRadius={3}>
            <Text color="grey" title fontWeight="bold" fontSize={10}>
              {Math.abs(value)}
            </Text>
          </Box>
        </Box>
      ))}
    </AnimatedBox>
  )
}

export default Datebar
