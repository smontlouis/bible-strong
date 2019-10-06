import React, { useState } from 'react'
import * as Animatable from 'react-native-animatable'
import { LinearGradient } from 'expo-linear-gradient'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useSelector } from 'react-redux'
import { withTheme } from 'emotion-theming'

import useDimensions from '~helpers/useDimensions'
import Image from '~common/ui/Image'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import Empty from '~common/Empty'
import Loading from '~common/Loading'

const AnimatableBox = Animatable.createAnimatableComponent(Box)

const shareImage = async source => {
  const { uri } = await FileSystem.downloadAsync(
    source,
    `${FileSystem.documentDirectory}verseOfTheDay.jpeg`
  )

  console.log('Finished downloading to ', uri)
  Sharing.shareAsync(uri)
}

const ShowMoreImage = ({ imageUrls, theme }) => {
  const {
    screen: { width }
  } = useDimensions()
  const [expandImage, setExpandImage] = useState(true)
  const themeDefault = useSelector(state => state.user.bible.settings.theme)

  if (!imageUrls) {
    return (
      <Box height={300} grey>
        <Loading />
      </Box>
    )
  }

  if (imageUrls.error) {
    return (
      <Box height={100} style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
        <Empty message="Impossible de charger l'image... Assurez-vous d'être connecté à Internet." />
      </Box>
    )
  }

  const linearGradientColor = themeDefault === 'default' ? '255, 255, 255' : '18,45,66'

  return (
    <Box grey>
      <AnimatableBox
        transition="height"
        position="relative"
        style={{
          height: width - 40,
          backgroundColor: theme.colors.lightGrey,
          borderRadius: 10,
          shadowColor: theme.colors.reverse,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
          elevation: 1,
          marginHorizontal: 20
        }}>
        {/* <Link onPress={() => shareImage(imageUrls.large)}> */}
        <Image
          thumbnailSource={{ uri: imageUrls.small }}
          source={{ uri: imageUrls.large, cache: 'force-cache' }}
          style={{
            width: width - 40,
            height: width - 40
          }}
          resizeMode="cover"
        />
        <Box
          style={{
            position: 'absolute',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            bottom: 0,
            right: 0,
            padding: 3
          }}>
          <Text fontSize={8}>copyright bible.com</Text>
        </Box>
        {/* </Link> */}
        <LinearGradient
          colors={[
            `rgba(${linearGradientColor},0)`,
            `rgba(${linearGradientColor},${expandImage ? 0 : 1})`
          ]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 100
          }}
        />
      </AnimatableBox>
      {/* <Link onPress={() => setExpandImage(e => !e)}>
        <Box padding={10} center>
          <FeatherIcon name={`chevron-${expandImage ? 'up' : 'down'}`} size={35} />
        </Box>
      </Link> */}
    </Box>
  )
}

export default withTheme(ShowMoreImage)
