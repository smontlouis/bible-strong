import React from 'react'
import * as Sentry from '@sentry/react-native'
import FastImage from 'react-native-fast-image'
import { useDispatch, useSelector } from 'react-redux'

import Box from '~common/ui/Box'
import { wp } from '~helpers/utils'
import { ImageSlice as ImageSliceProps } from '~common/types'
import { storageRef } from '~helpers/firebase'
import Loading from '~common/Loading'
import { cacheImage } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'

const imageWidth = wp(100) > 600 ? 600 : wp(100)

const useFireStorage = (src: string) => {
  const [imageUrl, setImageUrl] = React.useState<string>()
  const dispatch = useDispatch()
  const cachedUri = useSelector((state: RootState) => state.plan.images[src])

  React.useEffect(() => {
    ;(async () => {
      if (cachedUri) {
        setImageUrl(cachedUri)
        return
      }

      try {
        const uri = await storageRef.child(`images/${src}.png`).getDownloadURL()
        setImageUrl(uri)
        dispatch(cacheImage({ id: src, value: uri }))
      } catch (e) {
        Sentry.captureException(e)
        console.log(`can't find: images/${src}`)
      }
    })()
  }, [src, cachedUri, dispatch])

  return imageUrl
}

const ImageSlice = ({ src }: ImageSliceProps) => {
  const imageUrl = useFireStorage(src)

  return (
    <Box width={imageWidth} height={imageWidth}>
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
