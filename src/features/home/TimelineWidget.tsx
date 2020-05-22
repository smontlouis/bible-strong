import React from 'react'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'
import TimelineIcon from '~common/TimelineIcon'

const LinkBox = Box.withComponent(Link)

const color1 = 'rgb(69,150,220)'
const color2 = 'rgb(89,131,240)'

const TimelineWidget = () => {
  return (
    <Box grey px={20} bg="red" pt={30}>
      <LinkBox
        route="TimelineHome"
        backgroundColor="primary"
        rounded
        lightShadow
        row
        p={20}
        height={100}
        position="relative"
        overflow="hidden"
        alignItems="center"
        pl={30}
      >
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 100,
            borderRadius: 10,
          }}
        >
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: 130 }}
            colors={[color1, color2]}
          />
        </Box>
        <Box center size={50} bg="rgba(255, 255, 255, 0.2)" borderRadius={25}>
          <TimelineIcon color="white" size={70} style={{ marginTop: 8 }} />
        </Box>
        <Text title fontSize={17} color="white" ml={20}>
          Chronologie biblique
        </Text>
      </LinkBox>
    </Box>
  )
}

export default TimelineWidget
