import { Image } from 'expo-image'
import { useState } from 'react'

import { getEntityAvatarRadius, getEntityPortraitUri } from './entityPortraits'
import { useEntityPortraitHash } from './entityPortraitManifest'
import { getEntityPortraitLocalUri, useEntityPortraitLocalHashes } from './entityPortraitPack'
import { getStrongEntityPlaceholderSource } from './strongEntityAvatars'

/**
 * An entity's portrait, from the offline pack when the device holds it, otherwise from the media
 * host, or its placeholder when it has none or the portrait cannot be loaded (ADR-0089). While a portrait loads, the square stays empty, so a grey face
 * never turns into a painted one.
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
  const localHashes = useEntityPortraitLocalHashes()
  const [failedUris, setFailedUris] = useState<string[]>([])
  const candidates =
    uniqueName && hash
      ? [
          localHashes.has(hash) ? getEntityPortraitLocalUri(hash, 'w256') : undefined,
          getEntityPortraitUri(uniqueName, hash),
        ]
      : []
  const portraitUri = candidates.find(uri => uri && !failedUris.includes(uri))
  const style = {
    width: size,
    height: size,
    borderRadius: getEntityAvatarRadius(size),
    borderCurve: 'continuous' as const,
  }

  if (portraitUri) {
    return (
      <Image
        source={{ uri: portraitUri }}
        style={style}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        recyclingKey={portraitUri}
        onError={() => setFailedUris(failed => [...failed, portraitUri])}
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
