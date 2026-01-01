import React from 'react'
import { SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { offset } from './constants'
import { useTranslation } from 'react-i18next'

const Datebar = ({
  width,
  x,
  startYear,
  endYear,
  interval,
  color,
}: {
  x: SharedValue<number>
  width: number
  startYear: number
  endYear: number
  interval: number
  color: string
}) => {
  const [values, setValues] = React.useState<number[]>([])
  const { t } = useTranslation()

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
      b={useSafeAreaInsets().bottom}
      width={width}
      height={25}
      paddingLeft={offset}
      bg="reverse"
      lightShadow
      style={useAnimatedStyle(() => ({
        transform: [{ translateX: x.get() }],
        elevation: 0,
      }))}
    >
      {values.map(value => (
        <Box key={value} width={100} left={-50} alignItems="center" justifyContent="flex-end">
          <Box p={5} borderRadius={3} mb={3}>
            <Text color={color} title fontWeight="bold" fontSize={10}>
              {value < 2020 ? Math.abs(value) : t('Futur')}
            </Text>
          </Box>
        </Box>
      ))}
    </AnimatedBox>
  )
}

export default Datebar
