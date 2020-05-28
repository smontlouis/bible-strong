import React from 'react'
import * as Animatable from 'react-native-animatable'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { withTheme } from 'emotion-theming'

import useDimensions, { maxWidth } from '~helpers/useDimensions'
import Image from '~common/ui/Image'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Empty from '~common/Empty'
import Loading from '~common/Loading'

const AnimatableBox = Animatable.createAnimatableComponent(Box)

const shareImage = async (verseOfTheDay, source) => {
  const path = `${FileSystem.documentDirectory}${verseOfTheDay.v}.jpeg`
  const imageFile = await FileSystem.getInfoAsync(path)

  if (!imageFile.exists) {
    const { uri } = await FileSystem.downloadAsync(source, path)
    Sharing.shareAsync(uri)
  } else {
    Sharing.shareAsync(imageFile.uri)
  }
}

const ShowMoreImage = ({ imageUrls, verseOfTheDay, theme }) => {
  let {
    screen: { width },
  } = useDimensions()

  width = maxWidth(width)

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
  return (
    <Box pb={20}>
      <AnimatableBox
        transition="height"
        position="relative"
        style={{
          height: width - 80,
          backgroundColor: theme.colors.lightGrey,
          borderRadius: 10,
          shadowColor: theme.colors.reverse,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
          elevation: 1,
          marginHorizontal: 20,
        }}
      >
        <Link onPress={() => shareImage(verseOfTheDay, imageUrls.large)}>
          <Image
            thumbnailSource={{ uri: imageUrls.small }}
            source={{ uri: imageUrls.large, cache: 'force-cache' }}
            style={{
              width: width - 80,
              height: width - 80,
            }}
            resizeMode="cover"
          />
          <Box
            style={{
              position: 'absolute',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              bottom: 0,
              right: 0,
              padding: 3,
            }}
          >
            <Text fontSize={8}>copyright bible.com</Text>
          </Box>
        </Link>
      </AnimatableBox>
    </Box>
  )
}

export default withTheme(ShowMoreImage)
