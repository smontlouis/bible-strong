import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { offset } from './constants'
const Line = ({ lineX, color }: { lineX: SharedValue<number>; color: string }) => {
  const stylingTheme = useStylingTheme()

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous absolute bottom-[0px] w-[1px] h-[100%] opacity-[0.3]"
      pointerEvents="none"
      style={[
        { left: offset, backgroundColor: resolveThemeColor(stylingTheme, color) },
        useAnimatedStyle(() => ({
          transform: [{ translateX: lineX.get() }],
        })),
      ]}
    />
  )
}

export default Line
