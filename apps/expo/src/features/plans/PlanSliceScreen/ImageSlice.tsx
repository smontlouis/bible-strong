import React from 'react'

import { Image } from 'expo-image'
import Loading from '~common/Loading'
import { ImageSlice as ImageSliceProps } from '~common/types'
import Box from '~common/ui/Box'
import { useFireStorage } from '../plan.hooks'

const ImageSlice = ({ alt, src }: ImageSliceProps) => {
  const imageUrl = useFireStorage(src)

  return (
    <Box style={{ width: '100%', aspectRatio: 1 }} className="overflow-hidden border-continuous">
      {imageUrl ? (
        <Image
          alt={alt}
          accessible={Boolean(alt)}
          style={{ width: '100%', aspectRatio: 1 }}
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
