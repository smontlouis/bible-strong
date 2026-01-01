import { useEffect, useRef, useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import debounce from 'debounce'
import * as Sentry from '@sentry/react-native'

import {
  tabGroupsAtom,
  TabGroup,
  activeGroupIdAtom,
  DEFAULT_GROUP_ID,
  appSwitcherModeAtom,
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
} from '~helpers/tabGroupsFirestoreSync'
import { batchWriteSubcollection } from '~helpers/firestoreSubcollections'
import { registerCleanup } from '~helpers/cleanupRegistry'
import useLogin from '~helpers/useLogin'
import { usePrevious } from '~helpers/usePrevious'
import { isMigrationInProgress } from './migration'

const SYNC_DEBOUNCE_MS = 1000

// Store unsubscribe function at module level for cleanup before logout
let currentTabGroupsUnsubscribe: (() => void) | null = null

/**
 * Cleanup tabGroups Firestore subscription.
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
export const useTabGroupsSync = () => {
  const { isLogged, user } = useLogin()
  const isLoggedPrev = usePrevious(isLogged)
  const groups = useAtomValue(tabGroupsAtom)
  const setGroups = useSetAtom(tabGroupsAtom)
  const setActiveGroupId = useSetAtom(activeGroupIdAtom)

  const previousGroupsRef = useRef<TabGroup[]>([])
  const lastRemoteUpdateRef = useRef<number>(0)
  const isSyncingRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Cooldown period: sync debounce + small buffer
  const REMOTE_UPDATE_COOLDOWN = SYNC_DEBOUNCE_MS + 100

  const isNewlyLogged = isLogged && isLoggedPrev !== isLogged && typeof isLoggedPrev !== 'undefined'

  /**
   * Sync changed groups to Firestore
   */
  const syncChangesToFirestore = useCallback(
    async (userId: string, newGroups: TabGroup[], oldGroups: TabGroup[]) => {
      // Skip if we're currently syncing
      if (isSyncingRef.current) {
        return
      }

      // Skip sync during migration
      if (isMigrationInProgress()) {
        console.log('[TabGroupsSync] Skipping sync - migration in progress')
        return
      }

      isSyncingRef.current = true

      try {
        const newGroupIds = new Set(newGroups.map(g => g.id))
        const oldGroupIds = new Set(oldGroups.map(g => g.id))

        // Deleted groups
        for (const oldGroup of oldGroups) {
          if (!newGroupIds.has(oldGroup.id)) {
            await deleteTabGroupFromFirestore(userId, oldGroup.id)
          }
        }

        // Added or modified groups
        for (const newGroup of newGroups) {
          const oldGroup = oldGroups.find(g => g.id === newGroup.id)

          // Compare without base64Preview to detect actual changes
          const newForCompare = prepareTabGroupForSync(newGroup)
          const oldForCompare = oldGroup ? prepareTabGroupForSync(oldGroup) : null

          if (!oldForCompare || JSON.stringify(newForCompare) !== JSON.stringify(oldForCompare)) {
            await syncTabGroupToFirestore(userId, newGroup)
          }
        }
        console.log(`[TabGroupsSync] Synced groups to Firestore`)
      } catch (error) {
        console.error('[TabGroupsSync] Error syncing to Firestore:', error)
        Sentry.captureException(error, {
          tags: { feature: 'tabGroupsSync', action: 'syncChanges' },
        })
      } finally {
        isSyncingRef.current = false
      }
    },
    []
  )

  // Debounced version
  const debouncedSync = useCallback(debounce(syncChangesToFirestore, SYNC_DEBOUNCE_MS), [
    syncChangesToFirestore,
  ])

  /**
   * Handle initial load: migrate local groups to Firestore if needed
   */
  const handleInitialLoad = useCallback(
    async (userId: string) => {
      try {
        const localGroups = getDefaultStore().get(tabGroupsAtom)

        // Fetch remote groups
        const remoteGroups = await fetchTabGroupsFromFirestore(userId)

        if (remoteGroups.length === 0) {
          // No remote groups - upload local groups (initial migration)
          if (!hasTabGroupsMigrated() && localGroups.length > 0) {
            console.log('[TabGroupsSync] Migrating local groups to Firestore...')

            const changes = {
              set: {} as { [id: string]: any },
              delete: [] as string[],
            }

            for (const group of localGroups) {
              changes.set[group.id] = prepareTabGroupForSync(group)
            }

            await batchWriteSubcollection(userId, 'tabGroups', changes)
            setTabGroupsMigrated()
            console.log('[TabGroupsSync] Migration complete')
          }
        } else {
          // Merge remote with local, preserving local base64Previews
          const merged = mergeTabGroups(localGroups, remoteGroups)

          lastRemoteUpdateRef.current = Date.now()
          setGroups(merged)

          // Ensure active group exists
          const activeGroupId = getDefaultStore().get(activeGroupIdAtom)
          if (!merged.find(g => g.id === activeGroupId)) {
            setActiveGroupId(merged[0]?.id || DEFAULT_GROUP_ID)
          }

          // Reset to view mode (first tab expanded) and trigger animation reset
          const store = getDefaultStore()
          store.set(appSwitcherModeAtom, 'view')
          store.set(resetTabAnimationTriggerAtom, prev => prev + 1)

          console.log('[TabGroupsSync] Loaded and merged groups from Firestore')
        }
      } catch (error) {
        console.error('[TabGroupsSync] Error during initial load:', error)
        Sentry.captureException(error, {
          tags: { feature: 'tabGroupsSync', action: 'initialLoad' },
        })
      }
    },
    [setGroups, setActiveGroupId]
  )

  /**
   * Subscribe to Firestore changes
   */
  const setupFirestoreSubscription = useCallback(
    (userId: string) => {
      return subscribeToTabGroupsFirestore(userId, (data, changes) => {
        // Skip updates while migration is in progress
        if (isMigrationInProgress()) {
          console.log('[TabGroupsSync] Skipping Firestore update - migration in progress')
          return
        }

        // Skip if we're currently syncing to avoid loops
        if (isSyncingRef.current) {
          return
        }

        console.log(
          '[TabGroupsSync] Firestore update received:',
          Object.keys(data).length,
          'groups'
        )

        const localGroups = getDefaultStore().get(tabGroupsAtom)

        // Convert Firestore data to TabGroup array
        const remoteGroups: TabGroup[] = Object.values(data).map(g =>
          hydrateTabGroup(
            g as FirestoreTabGroup,
            localGroups.find(lg => lg.id === (g as any).id)
          )
        )

        // Sort by createdAt
        remoteGroups.sort((a, b) => a.createdAt - b.createdAt)

        // Merge with local (preserving local base64Previews and local-only groups)
        const merged = mergeTabGroups(localGroups, remoteGroups)

        lastRemoteUpdateRef.current = Date.now()
        setGroups(merged)
      })
    },
    [setGroups]
  )

  // Effect: Handle login/logout transitions
  useEffect(() => {
    if (isNewlyLogged && user.id) {
      // Just logged in - load from Firestore
      handleInitialLoad(user.id)
    }
  }, [isNewlyLogged, user.id, handleInitialLoad])

  // Effect: Setup Firestore subscription when logged in
  useEffect(() => {
    if (isLogged && user.id) {
      const unsubscribe = setupFirestoreSubscription(user.id)
      unsubscribeRef.current = unsubscribe
      // Also store at module level for cleanup before logout
      currentTabGroupsUnsubscribe = unsubscribe
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
        currentTabGroupsUnsubscribe = null
      }
    }
  }, [isLogged, user.id, setupFirestoreSubscription])

  // Effect: Watch local changes and sync to Firestore
  useEffect(() => {
    if (!isLogged || !user.id) {
      previousGroupsRef.current = groups
      return
    }

    // Don't sync on first render or when within cooldown period after remote update
    const timeSinceRemote = Date.now() - lastRemoteUpdateRef.current
    const isWithinCooldown = timeSinceRemote < REMOTE_UPDATE_COOLDOWN

    if (previousGroupsRef.current.length > 0 && !isWithinCooldown) {
      debouncedSync(user.id, groups, previousGroupsRef.current)
    }

    previousGroupsRef.current = groups
  }, [groups, isLogged, user.id, debouncedSync, REMOTE_UPDATE_COOLDOWN])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSync.clear()
    }
  }, [debouncedSync])
}

export default useTabGroupsSync
