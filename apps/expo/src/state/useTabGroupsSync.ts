import { useEffect } from 'react'
import { getDefaultStore } from 'jotai/vanilla'
import debounce from 'debounce'
import * as Sentry from '@sentry/react-native'

import {
  tabGroupsAtom,
  TabGroup,
  activeGroupIdAtom,
  DEFAULT_GROUP_ID,
  appSwitcherModeAtom,
  createDefaultGroup,
} from './tabs'
import { resetTabAnimationTriggerAtom } from './app'
import {
  syncTabGroupToFirestore,
  deleteTabGroupFromFirestore,
  fetchTabGroupsFromFirestore,
  subscribeToTabGroupsFirestore,
  mergeTabGroups,
  hydrateTabGroup,
  hasTabGroupsMigrated,
  setTabGroupsMigrated,
  prepareTabGroupForSync,
  FirestoreTabGroup,
  reconcileTabGroupsSnapshot,
} from '~helpers/tabGroupsFirestoreSync'
import { batchWriteSubcollection, type BatchChanges } from '~helpers/firestoreSubcollections'
import {
  firestoreSyncOutbox,
  runFirestoreSyncIntentsSerialized,
  type FirestoreSyncIntent,
} from '~helpers/firestoreSyncOutbox'
import { registerCleanup } from '~helpers/cleanupRegistry'
import useLogin from '~helpers/useLogin'
import { isMigrationInProgress } from './migration'
import {
  recordAccountMigrationDeletedDocuments,
  recordAccountMigrationPreferredDocuments,
} from '../migrations/accountMigrationMutationJournal'

import { createTabGroupsSyncQueue, type TabGroupChanges } from './tabGroupsSyncQueue'

const changesToIntent = (changes: TabGroupChanges): FirestoreSyncIntent => ({
  kind: 'subcollection',
  collection: 'tabGroups',
  set: Object.fromEntries(
    [...changes].flatMap(([id, group]) =>
      group ? [[id, prepareTabGroupForSync(group) as unknown as Record<string, unknown>]] : []
    )
  ),
  delete: [...changes].filter(([, group]) => !group).map(([id]) => id),
})

const SYNC_DEBOUNCE_MS = 1000

// Store unsubscribe function at module level for cleanup before logout
let currentTabGroupsUnsubscribe: (() => void) | null = null

/**
 * Stop tab group observation and persist unsent changes before account state is reset.
 * Call this BEFORE signOut() to avoid permission-denied errors.
 */
export const cleanupTabGroupsSubscription = () => {
  if (currentTabGroupsUnsubscribe) {
    console.log('[TabGroupsSync] Cleaning up subscription before logout...')
    currentTabGroupsUnsubscribe()
    currentTabGroupsUnsubscribe = null
    console.log('[TabGroupsSync] Subscription cleaned up')
  }
}

// Register cleanup function with the registry (breaks require cycle with FireAuth)
registerCleanup('tabGroupsSubscription', cleanupTabGroupsSubscription)

/**
 * Hook that syncs tab groups between Jotai state and Firestore
 *
 * Responsibilities:
 * - Watch local changes and sync to Firestore (debounced)
 * - Subscribe to Firestore changes and update local state
 * - Handle initial migration on first login
 * - Handle login/logout transitions
 */
export const useTabGroupsSync = ({
  incomingEnabled,
  outgoingEnabled,
}: {
  incomingEnabled: boolean
  outgoingEnabled: boolean
}) => {
  const { isLogged, user } = useLogin()

  useEffect(() => {
    if (!isLogged || !user.id) return
    const userId = user.id
    const store = getDefaultStore()
    let disposed = false
    let applyingRemote = false
    const setActiveGroupId = (id: string) => store.set(activeGroupIdAtom, id)

    const persistChanges = async (changes: TabGroupChanges) => {
      const intent = changesToIntent(changes)
      try {
        await runFirestoreSyncIntentsSerialized(userId, [intent], async () => {
          try {
            for (const [id, group] of changes) {
              if (group) await syncTabGroupToFirestore(userId, group)
              else await deleteTabGroupFromFirestore(userId, id)
            }
            firestoreSyncOutbox.supersedePending(
              userId,
              changesToIntent(new Map([...changes, ...queue.getOutstanding()]))
            )
          } catch (error) {
            firestoreSyncOutbox.enqueue(
              userId,
              changesToIntent(new Map([...changes, ...queue.getOutstanding()]))
            )
            throw error
          }
        })
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'tabGroupsSync', action: 'syncChanges' },
        })
      }
    }

    const queue = createTabGroupsSyncQueue(store.get(tabGroupsAtom), persistChanges)
    const flush = () => {
      if (incomingEnabled && isMigrationInProgress()) {
        debouncedSync()
        return
      }
      void queue.flush()
    }
    const debouncedSync = debounce(flush, SYNC_DEBOUNCE_MS)

    const applyRemoteGroups = (groups: TabGroup[]) => {
      const retryingIds = new Set<string>()
      for (const { intent } of firestoreSyncOutbox.getPending(userId)) {
        if (intent.kind === 'subcollection' && intent.collection === 'tabGroups') {
          Object.keys(intent.set).forEach(id => retryingIds.add(id))
          intent.delete.forEach(id => retryingIds.add(id))
        }
      }
      const merged = queue.applyRemote(groups, retryingIds)
      const safeGroups = merged.length > 0 ? merged : [createDefaultGroup()]
      // Update the baseline synchronously: a real user action after this write
      // must be recorded even if React batches both updates into one render.
      applyingRemote = true
      try {
        store.set(tabGroupsAtom, safeGroups)
      } finally {
        applyingRemote = false
      }
      return safeGroups
    }

    const unsubscribeLocal = outgoingEnabled
      ? store.sub(tabGroupsAtom, () => {
          if (applyingRemote) return
          const changes = queue.recordLocal(store.get(tabGroupsAtom))
          if (changes.size === 0) return
          if (!incomingEnabled) {
            recordAccountMigrationDeletedDocuments(
              userId,
              'tabGroups',
              [...changes].filter(([, group]) => !group).map(([id]) => id)
            )
            recordAccountMigrationPreferredDocuments(
              userId,
              'tabGroups',
              [...changes].filter(([, group]) => !!group).map(([id]) => id)
            )
          }
          if (!incomingEnabled || [...changes.values()].some(group => !group)) {
            debouncedSync.clear()
            flush()
          } else {
            debouncedSync()
          }
        })
      : () => {}

    const handleInitialLoad = async () => {
      let migrationChanges: BatchChanges | undefined
      try {
        // Fetch remote groups (uses cache-first mode internally for instant response)
        const remoteGroups = await fetchTabGroupsFromFirestore(userId)
        // Local state may have changed while Firestore was resolving its first
        // snapshot, so always reconcile against the latest persisted workspace.
        if (disposed) return
        const localGroups = getDefaultStore().get(tabGroupsAtom)

        if (remoteGroups.length === 0) {
          // No remote groups - upload local groups (initial migration)
          if (!hasTabGroupsMigrated() && localGroups.length > 0) {
            console.log('[TabGroupsSync] Migrating local groups to Firestore...')

            const changes: BatchChanges = {
              set: {},
              delete: [] as string[],
            }

            for (const group of localGroups) {
              changes.set[group.id] = prepareTabGroupForSync(group, { updatedAt: Date.now() })
            }

            migrationChanges = changes
            const intent: FirestoreSyncIntent = {
              kind: 'subcollection',
              collection: 'tabGroups',
              set: changes.set,
              delete: changes.delete,
            }
            await runFirestoreSyncIntentsSerialized(userId, [intent], async () => {
              try {
                await batchWriteSubcollection(userId, 'tabGroups', changes)
                firestoreSyncOutbox.supersedePending(userId, intent)
              } catch (error) {
                firestoreSyncOutbox.enqueue(userId, intent)
                migrationChanges = undefined
                throw error
              }
            })
            setTabGroupsMigrated()
            console.log('[TabGroupsSync] Migration complete')
          }
        } else {
          // Merge remote with local, preserving local base64Previews
          const merged = mergeTabGroups(localGroups, remoteGroups)

          const applied = applyRemoteGroups(merged)

          // Ensure active group exists
          const activeGroupId = getDefaultStore().get(activeGroupIdAtom)
          if (!applied.find(g => g.id === activeGroupId)) {
            setActiveGroupId(applied[0]?.id || DEFAULT_GROUP_ID)
          }

          // Reset to view mode (first tab expanded) and trigger animation reset
          // Keep the device-local active group/tab; the reset only realigns shared values.
          const store = getDefaultStore()
          store.set(appSwitcherModeAtom, 'view')
          store.set(resetTabAnimationTriggerAtom, prev => prev + 1)

          console.log('[TabGroupsSync] Loaded and merged groups from Firestore')
        }
      } catch (error) {
        if (migrationChanges) {
          firestoreSyncOutbox.enqueue(userId, {
            kind: 'subcollection',
            collection: 'tabGroups',
            set: migrationChanges.set,
            delete: migrationChanges.delete,
          })
        }
        console.error('[TabGroupsSync] Error during initial load:', error)
        Sentry.captureException(error, {
          tags: { feature: 'tabGroupsSync', action: 'initialLoad' },
        })
      }
    }

    let unsubscribeRemote: (() => void) | undefined
    if (incomingEnabled) {
      void handleInitialLoad()
      unsubscribeRemote = subscribeToTabGroupsFirestore(userId, (data, changes) => {
        if (disposed || isMigrationInProgress()) return
        const localGroups = store.get(tabGroupsAtom)
        const remoteGroups = Object.values(data).map(group =>
          hydrateTabGroup(
            group as FirestoreTabGroup,
            localGroups.find(local => local.id === group.id)
          )
        )
        const reconciled = reconcileTabGroupsSnapshot({
          localGroups,
          remoteGroups,
          removedIds: changes.removed,
          fromCache: changes.fromCache,
        })
        const applied = applyRemoteGroups(reconciled)
        const activeId = store.get(activeGroupIdAtom)
        if (!applied.some(group => group.id === activeId)) {
          setActiveGroupId(applied[0]?.id || DEFAULT_GROUP_ID)
          store.set(appSwitcherModeAtom, 'view')
          store.set(resetTabAnimationTriggerAtom, previous => previous + 1)
        }
      })
    }

    const cleanup = () => {
      if (disposed) return
      disposed = true
      unsubscribeLocal()
      unsubscribeRemote?.()
      if (currentTabGroupsUnsubscribe === cleanup) currentTabGroupsUnsubscribe = null
      debouncedSync.clear()
      const pending = queue.dispose()
      if (pending.size > 0) firestoreSyncOutbox.enqueue(userId, changesToIntent(pending))
    }
    currentTabGroupsUnsubscribe = cleanup
    return cleanup
  }, [incomingEnabled, outgoingEnabled, isLogged, user.id])
}

export default useTabGroupsSync
