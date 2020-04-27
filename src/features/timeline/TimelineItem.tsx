import React from 'react'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { TimelineSection } from './types'
import FastImage from 'react-native-fast-image'

const LinkBox = Box.withComponent(Link)

const TimelineItem = ({
  image,
  title,
  sectionTitle,
  subTitle,
  color,
  goTo,
}: TimelineSection & { goTo: number }) => {
  return (
    <LinkBox row px={20} center mb={30} route="Timeline" params={{ goTo }}>
      <Box
        position="relative"
        zIndex={2}
        width="45%"
        lightShadow
        borderRadius={10}
        height={180}
        bg="reverse"
        transform={[{ translateX: 20 }]}
        p={20}
        justifyContent="space-between"
      >
        <Text title fontSize={12}>
          {sectionTitle}
        </Text>
        <Text title fontSize={18}>
          {title}
        </Text>

        <Box>
          <Box height={2} bg="default" />

          <Text py={3} textAlign="center" fontSize={10} title>
            {subTitle}
          </Text>
          <Box height={2} bg="default" />
        </Box>
        <Box mx={40} height={10} bg={color} borderRadius={10} />
      </Box>
      <Box width="55%" height={250} borderRadius={10}>
        <FastImage
          source={{ uri: image }}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    </LinkBox>
  )
}

export default TimelineItem
