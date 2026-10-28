import { Image } from 'expo-image'
import { useState } from 'react'

import { getEntityPortraitUri } from './entityPortraits'
import { useEntityPortraitHash } from './entityPortraitManifest'
import { getStrongEntityPlaceholderSource } from './strongEntityAvatars'

/**
 * An entity's portrait from the media host, or its placeholder when it has none or the portrait
 * cannot be loaded (ADR-0089). While a portrait loads, the circle stays empty, so a grey face
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
  const [failedUri, setFailedUri] = useState<string>()
  const portraitUri = uniqueName && hash ? getEntityPortraitUri(uniqueName, hash) : undefined
  const style = { width: size, height: size, borderRadius: size / 2 }

  if (portraitUri && portraitUri !== failedUri) {
    return (
      <Image
        source={{ uri: portraitUri }}
        style={style}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        recyclingKey={portraitUri}
        onError={() => setFailedUri(portraitUri)}
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
