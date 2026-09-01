import { useSyncExternalStore } from 'react'

import { createOfflineCopyId, type OfflineCopyIdentity } from '~helpers/offlineCopyId'
import {
  offlineResourceRegistry,
  type OfflineResourceRegistryEntry,
  type OfflineResourceRegistrySnapshot,
} from './resourceAvailability'

export const useOfflineResourceRegistry = (): OfflineResourceRegistrySnapshot =>
  useSyncExternalStore(
    offlineResourceRegistry.subscribe,
    offlineResourceRegistry.getSnapshot,
    offlineResourceRegistry.getSnapshot
  )

export const useOfflineResourceState = (
  resource?: OfflineCopyIdentity | string
): OfflineResourceRegistryEntry | undefined => {
  const snapshot = useOfflineResourceRegistry()
  if (!resource) return undefined
  const id = typeof resource === 'string' ? resource : createOfflineCopyId(resource)
  return snapshot.resources.get(id)
}

export const useIsOfflineResourceInstalled = (resource?: OfflineCopyIdentity | string): boolean => {
  const state = useOfflineResourceState(resource)
  return state?.availability.status === 'available'
}
