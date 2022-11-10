import React from 'react'
import FastImage from 'react-native-fast-image'
import { useSelector } from 'react-redux'

import Box from '~common/ui/Box'
import { wp } from '~helpers/utils'
import { ImageSlice as ImageSliceProps } from '~common/types'
import Loading from '~common/Loading'
import { RootState } from '~redux/modules/reducer'
import { useFireStorage } from '../plan.hooks'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'

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
        <FastImage
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
