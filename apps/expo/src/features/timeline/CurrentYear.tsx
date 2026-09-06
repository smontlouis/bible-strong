import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import React from 'react'
import { Platform, TextInput } from 'react-native'
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Link from '~common/Link'
import Box, { AnimatedBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { wpUI } from '~helpers/utils'
import { offset } from './constants'
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)
type AnimatedTextInputAnimatedProps = React.ComponentProps<
  typeof AnimatedTextInput
>['animatedProps']

const LinkBox = (props: React.ComponentProps<typeof Box> & React.ComponentProps<typeof Link>) => (
  <Box
    as={Link}
    {...props}
    className={twMerge(
      'overflow-hidden border-continuous',
      twMerge('overflow-hidden border-continuous', props.className)
    )}
  />
)

const CurrentYear = ({
  year,
  x,
  width,
  lineX,
  color,
  onPrev,
  onNext,
  nextColor,
  prevColor,
}: {
  year: SharedValue<string>
  x: SharedValue<number>
  lineX: SharedValue<number>
  color: string
  width: number
  onPrev: () => void
  onNext: () => void
  prevColor?: string
  nextColor?: string
}) => {
  const stylingTheme = useStylingTheme()

  const r = useMediaQueriesArray()
  const progressInSection = useDerivedValue(() => {
    const progress = interpolate(
      x.get() * -1,
      [0, width - wpUI(100)],
      [0, 100],
      Extrapolation.CLAMP
    )
    return Math.round(progress)
  })

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous absolute left-[0px] right-[0px]"
      style={[
        { height: r([30, 40, 60, 60]), bottom: useSafeAreaInsets().bottom },
        useAnimatedStyle(() => ({
          transform: [{ translateX: lineX.get() }],
        })),
      ]}
    >
      {prevColor && (
        <LinkBox
          className="absolute bottom-[0px] left-[0px] rounded-tr-[5px] rounded-tl-[5px] bg-reverse items-center justify-center"
          onPress={onPrev}
          style={{
            width: r([30, 40, 60, 60]),
            height: r([30, 40, 60, 60]),
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            overflow: 'visible',
          }}
        >
          <FeatherIcon name="chevrons-left" size={20} color={prevColor} />
        </LinkBox>
      )}
      {nextColor && (
        <LinkBox
          className="ml-auto absolute bottom-[0px] right-[0px] rounded-tr-[5px] rounded-tl-[5px] bg-reverse items-center justify-center"
          onPress={onNext}
          style={{
            width: r([30, 40, 60, 60]),
            height: r([30, 40, 60, 60]),
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            overflow: 'visible',
          }}
        >
          <FeatherIcon name="chevrons-right" size={20} color={nextColor} />
        </LinkBox>
      )}
      <Box
        className="overflow-hidden border-continuous absolute bottom-[0px] w-[100px] h-[30px] items-center justify-center rounded-tl-[5px] rounded-tr-[5px]"
        pointerEvents="none"
        style={{ left: offset - 50, backgroundColor: resolveThemeColor(stylingTheme, color) }}
      >
        <AnimatedTextInput
          underlineColorAndroid="transparent"
          editable={false}
          animatedProps={
            useAnimatedProps<{ text: string }>(() => ({
              text: year.get(),
            })) as unknown as AnimatedTextInputAnimatedProps
          }
          defaultValue={year.get()}
          style={{
            color: 'white',
            width: 120,
            textAlign: 'center',
            fontWeight: 'bold',
            padding: 0,
            ...(Platform.OS === 'android' && {
              height: 30,
              lineHeight: 14,
              includeFontPadding: false,
              textAlignVertical: 'center',
            }),
          }}
        />
      </Box>
      <AnimatedBox
        className="overflow-hidden border-continuous absolute left-[0px] bottom-[0px] h-[3px]"
        style={[
          {
            backgroundColor: resolveThemeColor(stylingTheme, color),
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            overflow: 'visible',
          },
          useAnimatedStyle(() => ({
            width: `${progressInSection.value}%`,
          })),
        ]}
      />
    </AnimatedBox>
  )
}

export default CurrentYear
