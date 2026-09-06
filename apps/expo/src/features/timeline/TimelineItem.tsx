import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import React from 'react'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { TimelineSection } from './types'
import { Image } from 'expo-image'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { getTimelinePeriodImageSource } from './timelinePeriodImages'
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

const TimelineItem = ({
  image,
  title,
  titleEn,
  sectionTitle,
  sectionTitleEn,
  subTitle,
  subTitleEn,
  color,
  goTo,
  onPress,
}: TimelineSection & { goTo: number; onPress?: (goTo: number) => void }) => {
  const stylingTheme = useStylingTheme()

  const lang = useLanguage()
  return (
    <LinkBox
      className="px-[20px] mb-[30px] items-center justify-center flex-row"
      route={onPress ? undefined : 'Timeline'}
      params={onPress ? undefined : { goTo }}
      onPress={onPress ? () => onPress(goTo) : undefined}
    >
      <Box
        className="overflow-hidden border-continuous relative z-[2] w-[45%] max-w-[180px] rounded-[10px] h-[180px] bg-reverse p-[20px] justify-between"
        style={{
          transform: [{ translateX: 20 }],
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Text
          className="text-[12px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {getLegacyLocalizedField(lang, { fr: sectionTitle, en: sectionTitleEn })}
        </Text>
        <Text
          className="text-[18px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Text>

        <Box className="overflow-hidden border-continuous">
          <Box className="overflow-hidden border-continuous h-[2px] bg-default" />

          <Text
            className="py-[3px] text-center text-[10px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {getLegacyLocalizedField(lang, { fr: subTitle, en: subTitleEn })}
          </Text>
          <Box className="overflow-hidden border-continuous h-[2px] bg-default" />
        </Box>
        <Box
          className="overflow-hidden border-continuous mx-[40px] h-[10px] rounded-[10px]"
          style={{ backgroundColor: resolveThemeColor(stylingTheme, color) }}
        />
      </Box>
      <Box className="overflow-hidden border-continuous w-[55%] h-[250px] rounded-[10px]">
        <Image
          source={getTimelinePeriodImageSource(image)}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    </LinkBox>
  )
}

export default TimelineItem
