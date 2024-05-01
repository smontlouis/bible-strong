import React from 'react'

import { Image } from 'expo-image'
import Loading from '~common/Loading'
import { ImageSlice as ImageSliceProps } from '~common/types'
import Box from '~common/ui/Box'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { wp } from '~helpers/utils'
import { useFireStorage } from '../plan.hooks'

const imageWidth = wp(100) > 600 ? 600 : wp(100)

const ImageSlice = ({ src }: ImageSliceProps) => {
  const imageUrl = useFireStorage(src)
  const { colorScheme } = useCurrentThemeSelector()

  return (
    <Box
      width={imageWidth}
      height={imageWidth}
      {...(colorScheme === 'dark' && {
        borderRadius: 20,
      })}
    >
      {imageUrl ? (
        <Image
          style={{ width: imageWidth, height: imageWidth }}
          source={{
            uri: imageUrl,
          }}
        />
      ) : (
        <Loading />
      )}
    </Box>
  )
}

export default ImageSlice
