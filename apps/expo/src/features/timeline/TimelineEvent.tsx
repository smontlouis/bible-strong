import { twMerge } from '~common/ui/classNames'
import React from 'react'
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useTimelineLanguage from './useTimelineLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { calculateLabel, offset, rowToPx } from './constants'
import { TimelineEvent as TimelineEventProps } from './types'
const AnimatedBox = Animated.createAnimatedComponent(Box)
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

interface Props extends TimelineEventProps {
  x: SharedValue<number>
  yearsToPx: (years: number) => number
  calculateEventWidth: (yearStart: number, yearEnd: number, isFixed?: boolean) => number
  hasDetails?: boolean
  sectionIndex?: number
}

const descSize = 140
const imageSize = 60

const TimelineEvent = ({
  slug,
  row,
  title,
  titleEn,
  start,
  image,
  end,
  type,
  isFixed,
  x,
  yearsToPx,
  calculateEventWidth,
  hasDetails = true,
}: Props) => {
  const pushRouteOnce = usePushRouteOnce()
  const lang = useTimelineLanguage()
  const [top] = React.useState(() => rowToPx(row))
  const [left] = React.useState(() => yearsToPx(start))
  const [width] = React.useState(() => calculateEventWidth(start, end, isFixed))

  const label = calculateLabel(start, end, lang)

  const onOpenEvent = () => {
    if (!hasDetails) return

    pushRouteOnce({
      pathname: '/event',
      params: { slug },
    })
  }

  const posX = useDerivedValue(() => {
    return interpolate(
      x.get() * -1,
      [left + offset, left + width + offset - descSize - imageSize],
      [0, width - descSize - imageSize],
      Extrapolation.CLAMP
    )
  })

  const styles = useAnimatedStyle(() => ({
    transform: [{ translateX: posX.get() }],
  }))

  if (type === 'minor') {
    return (
      <LinkBox
        className="h-[25px] absolute bg-reverse flex-row rounded-[20px]"
        onPress={onOpenEvent}
        disabled={!hasDetails}
        style={[
          { opacity: !hasDetails ? 0.6 : 1 },
          [
            {
              top: top,
              left: left + offset,
              opacity: !hasDetails ? 0.6 : hasDetails ? 1 : 0.6,
              shadowColor: 'rgb(89,131,240)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 1,
              overflow: 'visible',
            },
          ],
        ]}
      >
        <Box className="overflow-hidden border-continuous rounded-tl-[10px] rounded-bl-[10px] bg-tertiary px-[10px] justify-center">
          <Text className="text-[white] text-[10px]" numberOfLines={1}>
            {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
          </Text>
        </Box>
        <Box className="overflow-hidden border-continuous px-[10px] justify-center">
          <Text className="text-[8px]">{label}</Text>
        </Box>
      </LinkBox>
    )
  }

  return (
    <LinkBox
      className="h-[60px] absolute bg-reverse flex-row rounded-[20px]"
      onPress={onOpenEvent}
      disabled={!hasDetails}
      style={[
        { opacity: !hasDetails ? 0.6 : 1 },
        [
          {
            width: width,
            top: top,
            left: left + offset,
            opacity: !hasDetails ? 0.6 : hasDetails ? 1 : 0.6,
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            overflow: 'visible',
          },
        ],
      ]}
    >
      <AnimatedBox
        className="px-[10px] py-[6px] relative items-center justify-center"
        style={[{ width: descSize }, styles]}
      >
        <Text className="text-[12px]" numberOfLines={2}>
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Text>
        <Box className="border-continuous overflow-hidden border-b-[1px] border-border" />
        <Text className="text-[10px] text-center">{label}</Text>
      </AnimatedBox>
      <Box
        className="overflow-hidden border-continuous ml-auto rounded-tr-[10px] rounded-br-[10px]"
        style={{ width: imageSize }}
      >
        <Image
          style={{ width: imageSize, height: '100%' }}
          source={{
            uri: image,
          }}
        />
      </Box>
    </LinkBox>
  )
}

export default TimelineEvent
