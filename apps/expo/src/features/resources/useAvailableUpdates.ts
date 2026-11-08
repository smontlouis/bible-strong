import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useEffectEvent } from 'react'
import { supportsOfflineCopies } from '~desktop/isDesktop'

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
  // The browser manages no Offline copy.
  return supportsOfflineCopies ? getAvailableUpdates(registry) : NO_UPDATES
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

  // `updates` is rebuilt on every render; its signature decides when to mark them seen.
  const markSeen = useEffectEvent(() => setSeen(seen => markUpdatesSeen(updates, seen)))

  useEffect(() => {
    markSeen()
  }, [signature, setSeen])
}
