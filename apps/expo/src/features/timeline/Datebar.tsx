import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { Platform } from 'react-native'
import { SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox } from '~common/ui/Box'
import { floatingShadow } from '~common/ui/surfaces'
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
      className="overflow-hidden border-continuous flex-row absolute left-[0px] h-[25px] bg-surface-raised"
      style={[
        {
          paddingLeft: offset,
          width: width,
          bottom: useSafeAreaInsets().bottom,
          // The bar spans the whole period (up to ~14,000pt): Android, which never drew its
          // shadow, is spared a blurred layer of that size.
          ...(Platform.OS !== 'android' && floatingShadow),
          overflow: 'visible',
        },
        useAnimatedStyle(() => ({
          transform: [{ translateX: x.get() }],
        })),
      ]}
    >
      {values.map(value => (
        <Box
          className="overflow-hidden border-continuous w-[100px] left-[-50px] items-center justify-end"
          key={value}
        >
          <Box className="overflow-hidden border-continuous p-[5px] mb-[3px]">
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
