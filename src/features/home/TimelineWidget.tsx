import React from 'react'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import TimelineIcon from '~common/TimelineIcon'
import { FeatherIcon } from '~common/ui/Icon'

const LinkBox = Box.withComponent(Link)

const TimelineWidget = () => {
  return (
    <Box grey pt={10}>
      <LinkBox
        row
        route="TimelineHome"
        alignItems="center"
        bg="reverse"
        lightShadow
        rounded
        px={20}
        pl={10}
        height={80}
      >
        <Box center size={50} bg="lightPrimary" borderRadius={25} ml={10}>
          <TimelineIcon color="primary" size={70} style={{ marginTop: 8 }} />
        </Box>
        <Text title fontSize={18} ml={20} flex>
          {'La Chronologie\nde la Bible'}
        </Text>
        <Box>
          <FeatherIcon name="chevron-right" size={20} />
        </Box>
      </LinkBox>
    </Box>
  )
}

export default TimelineWidget
