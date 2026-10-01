import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import {
  getAvailableUpdates,
  hasUnseenUpdates,
  markUpdatesSeen,
  type SeenResourceUpdates,
} from './availableUpdates'
import { useOfflineResourceRegistry } from './useOfflineResourceRegistry'

/** Updates shown to this device's reader, so the menu stops signalling them once seen. */
export const seenResourceUpdatesAtom = atomWithAsyncStorage<SeenResourceUpdates>(
  'seenResourceUpdates',
  {}
)

const NO_UPDATES = new Map<string, string>()

const useAvailableUpdateMap = () => {
  const registry = useOfflineResourceRegistry()
  // Offline copies are not managed on web.
  return Platform.OS === 'web' ? NO_UPDATES : getAvailableUpdates(registry)
}

export const useAvailableUpdatesIndicator = () => {
  const updates = useAvailableUpdateMap()
  const seen = useAtomValue(seenResourceUpdatesAtom)
  return {
    hasUpdates: updates.size > 0,
    hasUnseenUpdates: hasUnseenUpdates(updates, seen),
  }
}

/** Marks every available update as seen while the downloads screen is mounted. */
export const useMarkAvailableUpdatesSeen = () => {
  const updates = useAvailableUpdateMap()
  const setSeen = useSetAtom(seenResourceUpdatesAtom)
  const signature = [...updates].map(([id, update]) => `${id}=${update}`).join('|')

  useEffect(() => {
    setSeen(seen => markUpdatesSeen(updates, seen))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, setSeen])
}
