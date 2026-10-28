import { Image } from 'expo-image'

import { getEntityAvatarRadius } from './entityPortraits'
import { useEntityPortraitHash } from './entityPortraitManifest'
import { getStrongEntityPlaceholderSource } from './strongEntityAvatars'
import { useEntityPortraitImage } from './useEntityPortraitImage'

/**
 * An entity's portrait, from the offline pack when the device holds it, otherwise from the media
 * host, or its placeholder when it has none or the portrait cannot be loaded (ADR-0089). While a
 * portrait loads, the square stays empty, so a grey face never turns into a painted one.
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
  const style = {
    width: size,
    height: size,
    borderRadius: getEntityAvatarRadius(size),
    borderCurve: 'continuous' as const,
  }

  if (portrait.uri) {
    return (
      <Image
        source={{ uri: portrait.uri }}
        style={style}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        recyclingKey={portrait.uri}
        onError={portrait.onError}
      />
    )
  }

  return (
    <Image
      source={getStrongEntityPlaceholderSource(category, type, uniqueName ?? seed ?? '')}
      style={style}
      contentFit="cover"
    />
  )
}

export default StrongEntityAvatar
