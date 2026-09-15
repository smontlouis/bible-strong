import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { offset } from './constants'
import { useTimelineTranslation } from './useTimelineLanguage'
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
  const stylingTheme = useStylingTheme()

  const { t } = useTimelineTranslation()
  const values: number[] = []
  for (let year = startYear; year < endYear; year += interval) {
    values.push(year)
  }

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous flex-row absolute left-[0px] h-[25px] bg-reverse"
      style={[
        {
          paddingLeft: offset,
          width: width,
          bottom: useSafeAreaInsets().bottom,
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        },
        useAnimatedStyle(() => ({
          transform: [{ translateX: x.get() }],
          elevation: 0,
        })),
      ]}
    >
      {values.map(value => (
        <Box
          className="overflow-hidden border-continuous w-[100px] left-[-50px] items-center justify-end"
          key={value}
        >
          <Box className="overflow-hidden border-continuous p-[5px] rounded-[3px] mb-[3px]">
            <Text
              className="font-bold text-[10px]"
              style={{
                color: resolveThemeColor(stylingTheme, color) || stylingTheme.colors.default,
                fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
              }}
            >
              {value < 2020 ? Math.abs(value) : t('Futur')}
            </Text>
          </Box>
        </Box>
      ))}
    </AnimatedBox>
  )
}

export default Datebar
