import { useEffect, useRef, useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import debounce from 'debounce'
import * as Sentry from '@sentry/react-native'

import { tabGroupsAtom, TabGroup, activeGroupIdAtom, DEFAULT_GROUP_ID } from './tabs'
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
import useLogin from '~helpers/useLogin'
import { usePrevious } from '~helpers/usePrevious'
import { isMigrationInProgress } from './migration'

const SYNC_DEBOUNCE_MS = 1000

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
  const isRemoteUpdateRef = useRef(false)
  const isSyncingRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const isNewlyLogged = isLogged && isLoggedPrev !== isLogged && typeof isLoggedPrev !== 'undefined'

  /**
   * Sync changed groups to Firestore
   */
  const syncChangesToFirestore = useCallback(
    async (userId: string, newGroups: TabGroup[], oldGroups: TabGroup[]) => {
      if (isRemoteUpdateRef.current || isSyncingRef.current) {
        isRemoteUpdateRef.current = false
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

          isRemoteUpdateRef.current = true
          setGroups(merged)

          // Ensure active group exists
          const activeGroupId = getDefaultStore().get(activeGroupIdAtom)
          if (!merged.find(g => g.id === activeGroupId)) {
            setActiveGroupId(merged[0]?.id || DEFAULT_GROUP_ID)
          }

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

        isRemoteUpdateRef.current = true
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
      unsubscribeRef.current = setupFirestoreSubscription(user.id)
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [isLogged, user.id, setupFirestoreSubscription])

  // Effect: Watch local changes and sync to Firestore
  useEffect(() => {
    if (!isLogged || !user.id) {
      previousGroupsRef.current = groups
      return
    }

    // Don't sync on first render or when coming from remote update
    if (previousGroupsRef.current.length > 0 && !isRemoteUpdateRef.current) {
      debouncedSync(user.id, groups, previousGroupsRef.current)
    }

    previousGroupsRef.current = groups
    isRemoteUpdateRef.current = false
  }, [groups, isLogged, user.id, debouncedSync])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSync.clear()
    }
  }, [debouncedSync])
}

export default useTabGroupsSync
