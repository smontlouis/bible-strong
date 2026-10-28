import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

import { getEntityAvatarRadius } from './entityPortraits'
import { useEntityPortraitHash } from './entityPortraitManifest'
import { getStrongEntityPlaceholderSource } from './strongEntityAvatars'
import { useEntityPortraitGround } from './useEntityPortraitGround'
import { useEntityPortraitImage } from './useEntityPortraitImage'

/**
 * An entity's portrait, from the offline pack when the device holds it, otherwise from the media
 * host, or its placeholder when it has none or the portrait cannot be loaded (ADR-0089). While a
 * portrait loads, the square shows only its ground, so a grey face never turns into a painted one.
 * Characters are cut out: the square draws their ground (`getEntityPortraitGround`).
 */
const StrongEntityAvatar = ({
  uniqueName,
  seed,
  category,
  type,
  size,
}: {
  uniqueName?: string
  /** Picks the placeholder when the entity has no unique name. */
  seed?: string
  category: string
  type: string
  size: number
}) => {
  const hash = useEntityPortraitHash(uniqueName)
  const portrait = useEntityPortraitImage(uniqueName, hash, 'w256')
  const ground = useEntityPortraitGround()
  const style = {
    width: size,
    height: size,
    borderRadius: getEntityAvatarRadius(size),
    borderCurve: 'continuous' as const,
    overflow: 'hidden' as const,
    experimental_backgroundImage: ground,
  }

  return (
    <View style={style}>
      {portrait.uri ? (
        <Image
          source={{ uri: portrait.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          recyclingKey={portrait.uri}
          onError={portrait.onError}
        />
      ) : (
        <Image
          source={getStrongEntityPlaceholderSource(category, type, uniqueName ?? seed ?? '')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}
    </View>
  )
}

export default StrongEntityAvatar
