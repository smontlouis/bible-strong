import React from 'react'
import Lottie from 'lottie-react-native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import { MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'
import TimelineIcon from '~common/TimelineIcon'

const LinkBox = Box.withComponent(Link)

const color1 = '#80d0c7'
const color2 = '#13547a'

const PremiumWidget = () => {
  return (
    <Box grey px={20} bg="red" py={30}>
      <LinkBox
        route="Premium"
        backgroundColor="primary"
        rounded
        lightShadow
        p={20}
        height={130}
        position="relative"
        overflow="hidden"
        center
      >
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 130,
            borderRadius: 10,
          }}
        >
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: 130 }}
            colors={[color1, color2]}
          />
        </Box>
        <Lottie
          autoPlay
          style={{
            position: 'absolute',
            top: -30,
            left: -30,
            width: 300,
            height: 300,
          }}
          source={require('../../assets/images/premium-icon.json')}
        />
        <Text title fontSize={17} color="white" textAlign="center">
          Bible Strong - premium
        </Text>
        <Text
          marginTop={10}
          fontSize={14}
          textAlign="center"
          color="white"
          paddingHorizontal={40}
        >
          Supportez-nous et débloquez toutes les fonctionnalités !
        </Text>
      </LinkBox>
    </Box>
  )
}

export default PremiumWidget
