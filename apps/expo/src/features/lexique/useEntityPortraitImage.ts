import { useState } from 'react'

import { getEntityPortraitLocalUri, useEntityPortraitLocalHashes } from './entityPortraitPack'
import { getEntityPortraitUri, type EntityPortraitSize } from './entityPortraits'

/**
 * The address of a picture: the offline pack's file when the device holds it, otherwise the media
 * host's copy (ADR-0089). `onError` moves to the next address; `uri` is undefined once none is left.
 */
export const useEntityPortraitImage = (
  uniqueName: string | undefined,
  hash: string | undefined,
  size: EntityPortraitSize
) => {
  const localHashes = useEntityPortraitLocalHashes()
  const [failedUris, setFailedUris] = useState<string[]>([])
  const candidates =
    uniqueName && hash
      ? [
          localHashes.has(hash) ? getEntityPortraitLocalUri(hash, size) : undefined,
          getEntityPortraitUri(uniqueName, hash, size),
        ]
      : []
  const uri = candidates.find(candidate => candidate && !failedUris.includes(candidate))
  return {
    uri,
    onError: () => {
      if (uri) setFailedUris(failed => [...failed, uri])
    },
  }
}
