import React from 'react'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { TimelineSection } from './types'
import { Image } from 'expo-image'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'

const LinkBox = Box.withComponent(Link)

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
}: TimelineSection & { goTo: number }) => {
  const lang = useLanguage()
  return (
    <LinkBox row px={20} center mb={30} route="Timeline" params={{ goTo }}>
      <Box
        position="relative"
        zIndex={2}
        width="45%"
        maxWidth={180}
        lightShadow
        borderRadius={10}
        height={180}
        bg="reverse"
        transform={[{ translateX: 20 }]}
        p={20}
        justifyContent="space-between"
      >
        <Text title fontSize={12}>
          {getLegacyLocalizedField(lang, { fr: sectionTitle, en: sectionTitleEn })}
        </Text>
        <Text title fontSize={18}>
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Text>

        <Box>
          <Box height={2} bg="default" />

          <Text py={3} textAlign="center" fontSize={10} title>
            {getLegacyLocalizedField(lang, { fr: subTitle, en: subTitleEn })}
          </Text>
          <Box height={2} bg="default" />
        </Box>
        <Box mx={40} height={10} bg={color} borderRadius={10} />
      </Box>
      <Box width="55%" height={250} borderRadius={10}>
        <Image
          source={{ uri: image }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    </LinkBox>
  )
}

export default TimelineItem
