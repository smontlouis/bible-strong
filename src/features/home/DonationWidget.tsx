import Lottie from 'lottie-react-native'
import React from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'

const LinkBox = Box.withComponent(Link)

const color1 = '#E0EAFC'
const color2 = '#CFDEF3'

const DonationWidget = () => {
  const isFr = useLanguage()
  const { t } = useTranslation()
  return (
    <Box bg="lightGrey" px={20} pt={20} pb={20}>
      <LinkBox
        href={`https://bible-strong.app/${isFr ? 'fr/' : ''}give`}
        backgroundColor="primary"
        borderRadius={30}
        lightShadow
        p={20}
        height={130}
        position="relative"
        overflow="hidden"
        center
      >
        <Box pos="absolute" left={0} right={0} top={0} height={130} borderRadius={30}>
          <LinearGradient start={[0.1, 0.2]} style={{ height: 130 }} colors={[color1, color2]} />
        </Box>
        <Lottie
          autoPlay
          style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 300,
            height: 300,
          }}
          source={require('../../assets/images/donation.json')}
        />
        <Box pl={60}>
          <Text title fontSize={20} color="black">
            {t('donation.title')}
          </Text>
          <Text marginTop={5} fontSize={16} color="black">
            {t('donation.description')}
          </Text>
        </Box>
      </LinkBox>
    </Box>
  )
}

export default DonationWidget
