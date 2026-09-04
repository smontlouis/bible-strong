import React from 'react'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

const LinkBox = Box.withComponent(Link)

const TimelineWidget = () => {
  const { t } = useTranslation()

  return (
    <Box flex borderRadius={20} lightShadow overflow="visible">
      <LinkBox flex route="TimelineHome" bg="reverse" rounded>
        <Box height={92} bg="lightGrey">
          <Image
            source={require('~assets/images/home/bible-timeline.jpg')}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
        <Box flex p={12} pr={48}>
          <Text title fontSize={15} lineHeight={18} numberOfLines={2}>
            {t('La Chronologie\nde la Bible')}
          </Text>
          <Box
            pos="absolute"
            right={10}
            bottom={10}
            size={32}
            borderRadius={17}
            bg="lightPrimary"
            center
          >
            <FeatherIcon color="primary" name="chevron-right" size={18} />
          </Box>
        </Box>
      </LinkBox>
    </Box>
  )
}

export default TimelineWidget
