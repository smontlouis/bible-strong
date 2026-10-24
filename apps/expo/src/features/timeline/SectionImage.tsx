import { resolveThemeColor, titleFontStyle } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { Image } from 'expo-image'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { radii } from '~common/ui/surfaces'
import Text from '~common/ui/Text'
import useTimelineLanguage from './useTimelineLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { wp } from '~helpers/utils'
import { ShallowTimelineSection } from './types'
import { getTimelinePeriodImageSource } from './timelinePeriodImages'
const width = wp(50, 500)

const SectionImage = ({
  image,
  title,
  titleEn,
  sectionTitle,
  sectionTitleEn,
  color,
  subTitle,
  subTitleEn,
  direction,
}: ShallowTimelineSection & { direction?: 'previous' | 'next' }) => {
  const stylingTheme = useStylingTheme()

  const lang = useTimelineLanguage()

  return (
    <Box className="overflow-hidden border-continuous flex-[1] bg-canvas flex-row">
      <Box className="overflow-hidden border-continuous w-[60px] items-center justify-center">
        {direction === 'previous' && <FeatherIcon name="chevron-left" size={60} />}
      </Box>
      <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
        <Text className="text-[20px]" style={titleFontStyle(stylingTheme)}>
          {getLegacyLocalizedField(lang, { fr: sectionTitle, en: sectionTitleEn })}
        </Text>

        <Text className="py-[10px] text-[30px] text-center" style={titleFontStyle(stylingTheme)}>
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn }).toUpperCase()}
        </Text>

        <Box className="overflow-hidden border-continuous">
          <Box className="overflow-hidden border-continuous h-[2px] bg-default" />

          <Text className="py-[3px] text-center" style={titleFontStyle(stylingTheme)}>
            {getLegacyLocalizedField(lang, { fr: subTitle, en: subTitleEn })}
          </Text>
          <Box className="overflow-hidden border-continuous h-[2px] bg-default" />
        </Box>
        <Box
          className="overflow-hidden border-continuous flex-row mt-[50px] rounded-[12px]"
          style={{ width: width }}
        >
          <Image
            style={{ width, height: width, borderRadius: radii.control }}
            source={getTimelinePeriodImageSource(image)}
          />
        </Box>
        <Box
          className="overflow-hidden border-continuous mt-[50px] w-[50px] h-[10px] rounded-full"
          style={{ backgroundColor: resolveThemeColor(stylingTheme, color) }}
        />
      </Box>
      <Box className="overflow-hidden border-continuous w-[60px] items-center justify-center">
        {direction === 'next' && <FeatherIcon name="chevron-right" size={60} />}
      </Box>
    </Box>
  )
}

export default SectionImage
