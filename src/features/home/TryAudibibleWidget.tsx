import React from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Image } from 'react-native'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const LinkBox = Box.withComponent(Link)

const color1 = '#010F1B'
const color2 = '#132E4D'

const TryAudibibleWidget = () => {
  const { t } = useTranslation()
  return (
    <Box bg="lightGrey" px={20} pb={40}>
      <LinkBox
        href={`https://audibible.app`}
        backgroundColor="primary"
        borderRadius={30}
        lightShadow
        p={20}
        height={100}
        position="relative"
        overflow="hidden"
        alignItems="center"
        row
      >
        <Box
          pos="absolute"
          left={0}
          right={0}
          top={0}
          height={100}
          borderRadius={30}
        >
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: 100 }}
            colors={[color1, color2]}
          />
        </Box>
        <Image
          style={{
            width: 50,
            height: 50,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: 'white',
          }}
          source={require('../../assets/images/audibible-icon.png')}
        />
        <Box ml={16}>
          <Text title fontSize={20} color="white">
            {t('audibible.try')}
          </Text>
          <Text fontSize={16} color="white">
            {t('audibible.description')}
          </Text>
        </Box>
      </LinkBox>
    </Box>
  )
}

export default TryAudibibleWidget
