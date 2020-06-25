import React from 'react'
import Lottie from 'lottie-react-native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'
import { useIsPremium } from '~helpers/usePremium'

const LinkBox = Box.withComponent(Link)

const color1 = '#80d0c7'
const color2 = '#13547a'

const PremiumWidget = () => {
  const isPremium = useIsPremium()
  return (
    <Box grey px={20} pt={20} pb={60}>
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
        <Box pl={60}>
          <Text title fontSize={20} color="white">
            {isPremium
              ? 'Vous êtes Premium !\nMerci !'
              : 'Devenez un sponsor !'}
          </Text>
          <Text marginTop={5} fontSize={14} color="white">
            {isPremium
              ? 'Voir vos avantages !'
              : 'Supportez-nous et débloquez toutes les fonctionnalités !'}
          </Text>
        </Box>
      </LinkBox>
    </Box>
  )
}

export default PremiumWidget
