import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import {
  addStudies,
  deleteStudy,
  finishUserDataSync,
  type FireStoreUserData,
  markUserDataSyncCollectionLoaded,
  receiveLiveUpdates,
  receiveSubcollectionUpdates,
  startUserDataSync,
  type Study,
  type StudyMutation,
  type UserDataSyncCollection,
  updateStudy,
} from '~redux/modules/user'
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { firebaseDb, doc, collection, query, where, onSnapshot, updateDoc } from './firebase'
import { registerCleanup } from './cleanupRegistry'
import useLogin from './useLogin'
import { usePrevious } from './usePrevious'
import {
  batchWriteSubcollection,
  subscribeToSubcollection,
  type SubcollectionData,
  USER_DATA_SUBCOLLECTION_NAMES,
} from './firestoreSubcollections'
import { store } from '~redux/store'
import { isMigrationInProgress } from '~state/migration'
import {
  canonicalizeLegacySubcollectionData,
  migrateLegacyPersistedValue,
} from '../migrations/legacyPersistedReferences'
import { appLogger } from './agentObservability'
import { firestoreSyncOutbox } from './firestoreSyncOutbox'
import { useConnectionStatus } from './useConnection'

let isFirstSnapshotListener = true

// Store unsubscribe functions at module level for cleanup before logout
let currentUnsubscribeUsers: (() => void) | undefined
let currentUnsubscribeStudies: (() => void) | undefined
let currentSubcollectionUnsubscribes: (() => void)[] = []

const SYNC_FALLBACK_TIMEOUT_MS = 15000
const TRACKED_SYNC_COLLECTIONS: UserDataSyncCollection[] = [
  'bookmarks',
  'highlights',
  'notes',
  'links',
  'relations',
  'tags',
  'wordAnnotations',
  'studies',
]

const isTrackedSyncCollection = (collection: string): collection is UserDataSyncCollection =>
  TRACKED_SYNC_COLLECTIONS.includes(collection as UserDataSyncCollection)

/**
 * Cleanup all Firestore subscriptions.
 * Call this BEFORE signOut() to avoid permission-denied errors.
 */
export const cleanupFirestoreSubscriptions = () => {
  console.log('[LiveUpdates] Cleaning up Firestore subscriptions before logout...')
  isFirstSnapshotListener = true
  currentUnsubscribeUsers?.()
  currentUnsubscribeStudies?.()
  currentSubcollectionUnsubscribes.forEach(unsubscribe => unsubscribe())
  // Clear references
  currentUnsubscribeUsers = undefined
  currentUnsubscribeStudies = undefined
  currentSubcollectionUnsubscribes = []
  console.log('[LiveUpdates] Subscriptions cleaned up')
}

// Register cleanup function with the registry (breaks require cycle with FireAuth)
registerCleanup('firestoreSubscriptions', cleanupFirestoreSubscriptions)

interface AccountMigrationCoordinator {
  enabled: boolean
  runBeforeSync(userId: string, state: RootState): Promise<boolean>
  resumeToken: number
}

const useLiveUpdates = ({ enabled, runBeforeSync, resumeToken }: AccountMigrationCoordinator) => {
  const { isLogged, user } = useLogin()
  const isLoggedPrev = usePrevious(isLogged)
  const dispatch = useDispatch()
  const migrationRunRef = useRef<Promise<boolean> | undefined>(undefined)
  const migrationRunnerRef = useRef(runBeforeSync)
  const connectionStatus = useConnectionStatus()
  migrationRunnerRef.current = runBeforeSync

  const isNewlyLogged = isLogged && isLoggedPrev !== isLogged && typeof isLoggedPrev !== 'undefined'

  const isLoading = useSelector((state: RootState) => state.user.isLoading)
  const hasStudies = useSelector(
    (state: RootState) => Object.keys(state.user.bible.studies).length > 0
  )

  useEffect(() => {
    if (!enabled || !isLogged || !user.id || connectionStatus !== 'internet') return
    firestoreSyncOutbox.resumeReplay(user.id)
    void firestoreSyncOutbox.replay(user.id)
    return () => firestoreSyncOutbox.cancelReplay(user.id)
  }, [connectionStatus, enabled, isLogged, user.id])

  useEffect(() => {
    // Use module-level variables for cleanup access before logout
    currentUnsubscribeUsers = undefined
    currentUnsubscribeStudies = undefined
    currentSubcollectionUnsubscribes = []
    let syncFallbackTimeout: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    const authoritativeSubcollections = new Set<string>()

    const setupListeners = async () => {
      if (!enabled || !isLogged || isLoading !== false || !user.id) {
        return
      }
      const userId = user.id

      dispatch(startUserDataSync())
      syncFallbackTimeout = setTimeout(() => {
        const sync = store.getState().user.sync
        if (!sync?.isLoading) {
          return
        }

        console.warn('[LiveUpdates] User data sync timed out, keeping local data visible')
        appLogger.captureError(
          'sync',
          'account_sync.initial_load_timeout',
          new Error('ACCOUNT_SYNC_INITIAL_LOAD_TIMEOUT'),
          { timeoutMs: SYNC_FALLBACK_TIMEOUT_MS }
        )
        dispatch(finishUserDataSync())
      }, SYNC_FALLBACK_TIMEOUT_MS)

      // Account migrations run serially through the shared orchestrator before
      // live listeners can observe partially migrated cloud data.
      const precedingRun = migrationRunRef.current
      if (precedingRun) {
        await precedingRun.catch(() => false)
        if (disposed) return
      }
      let accountMigrationsCompleted = false
      const migrationRun = migrationRunnerRef.current(userId, store.getState())
      migrationRunRef.current = migrationRun
      try {
        accountMigrationsCompleted = await migrationRun
      } catch (error) {
        appLogger.captureError('startup', 'account_sync.migration_failed', error, {
          feature: 'firestore_migration',
          action: 'run_account_migrations',
        })
      }
      if (migrationRunRef.current === migrationRun) {
        migrationRunRef.current = undefined
      }
      if (!accountMigrationsCompleted || disposed) {
        if (!disposed) dispatch(finishUserDataSync())
        return
      }

      // Subscribe to user document (settings, subscription, etc.)
      currentUnsubscribeUsers = onSnapshot(doc(firebaseDb, 'users', userId), docSnapshot => {
        const source = docSnapshot?.metadata.hasPendingWrites ? 'Local' : 'Server'
        if (source === 'Local' || !docSnapshot) return

        const userData = docSnapshot.data() as FireStoreUserData | undefined

        if (!userData?.id) {
          return
        }

        // Ne pas inclure les sous-collections dans les live updates
        // Elles sont gérées séparément
        const { bible, ...otherUserData } = userData
        const {
          highlights: _h,
          notes: _n,
          tags: _t,
          strongsHebreu: _sh,
          strongsGrec: _sg,
          words: _w,
          naves: _nv,
          ...otherBible
        } = bible || {}
        const canonicalBible = migrateLegacyPersistedValue(otherBible)
        const canonicalSettings = migrateLegacyPersistedValue(otherBible.settings)
        if (JSON.stringify(canonicalSettings) !== JSON.stringify(otherBible.settings)) {
          updateDoc(doc(firebaseDb, 'users', userId), {
            'bible.settings': canonicalSettings,
          }).catch(error => {
            appLogger.captureError(
              'startup',
              'account_sync.legacy_settings_writeback_failed',
              error
            )
          })
        }

        dispatch(
          receiveLiveUpdates({
            remoteUserData: {
              ...otherUserData,
              bible: canonicalBible,
            } as unknown as FireStoreUserData,
          })
        )
      })

      // Subscribe to each subcollection
      for (const collection of USER_DATA_SUBCOLLECTION_NAMES) {
        const unsubscribe = subscribeToSubcollection(
          userId,
          collection,
          (data, changes) => {
            // Skip updates while migration is in progress to prevent race conditions
            // Migration writes in chunks, and between chunks the listener could fire
            // with incomplete/stale data, overwriting the correctly-imported Redux state
            if (isMigrationInProgress()) {
              console.log(`[LiveUpdates] Skipping ${collection} update - migration in progress`)
              return
            }

            console.log(`[LiveUpdates] ${collection} updated:`, Object.keys(data).length, 'items')

            const canonical = canonicalizeLegacySubcollectionData(data)
            const canonicalAdded = canonicalizeLegacySubcollectionData(changes.added).data
            const canonicalModified = canonicalizeLegacySubcollectionData(changes.modified).data
            if (changes.isFirstSnapshot) authoritativeSubcollections.delete(collection)
            const isFirstAuthoritativeSnapshot =
              !changes.fromCache &&
              (changes.isFirstSnapshot || !authoritativeSubcollections.has(collection))
            if (!changes.fromCache) authoritativeSubcollections.add(collection)
            if (Object.keys(canonical.changedDocuments).length > 0) {
              batchWriteSubcollection(userId, collection, {
                set: canonical.changedDocuments as SubcollectionData,
                delete: [],
                merge: false,
              }).catch(error => {
                appLogger.captureError(
                  'startup',
                  'account_sync.legacy_reference_writeback_failed',
                  error,
                  {
                    collection,
                  }
                )
              })
            }

            // Dispatch l'update pour cette collection spécifique
            dispatch(
              receiveSubcollectionUpdates({
                collection,
                data: canonical.data as SubcollectionData,
                changes: {
                  added: canonicalAdded as SubcollectionData,
                  modified: canonicalModified as SubcollectionData,
                  removed: changes.removed,
                },
                isInitialLoad:
                  isFirstAuthoritativeSnapshot ||
                  (changes.fromCache &&
                    Object.keys(canonicalAdded).length === Object.keys(canonical.data).length),
                fromCache: changes.fromCache,
              })
            )
          },
          error => {
            console.warn(`[LiveUpdates] ${collection} sync unavailable, using local data`, error)
            appLogger.captureError('sync', 'account_sync.subscription_failed', error, {
              collection,
            })
            if (isTrackedSyncCollection(collection)) {
              dispatch(markUserDataSyncCollectionLoaded({ collection }))
            }
          },
          { includeMetadataChanges: true }
        )
        currentSubcollectionUnsubscribes.push(unsubscribe)
      }

      // Subscribe to studies collection
      currentUnsubscribeStudies = onSnapshot(
        query(collection(firebaseDb, 'studies'), where('user.id', '==', userId)),
        querySnapshot => {
          const source = querySnapshot?.metadata.hasPendingWrites ? 'Local' : 'Server'
          if (source === 'Local' || !querySnapshot) return

          if (isNewlyLogged || !hasStudies) {
            const studies = {} as { [key: string]: Study }
            querySnapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
              const study = docSnap.data() as Study
              studies[study.id] = study
            })

            console.log('[LiveUpdates] Add all studies')
            dispatch(addStudies(studies))
          } else {
            querySnapshot.docChanges().forEach((change: FirebaseFirestoreTypes.DocumentChange) => {
              // Ignore first listener adding all documents
              if (isFirstSnapshotListener) return

              if (change.type === 'added') {
                console.log('[LiveUpdates] Added study:', change.doc.data().id)

                dispatch(
                  updateStudy({
                    ...(change.doc.data() as StudyMutation),
                  })
                )
              }
              if (change.type === 'modified') {
                console.log('[LiveUpdates] Modified study:', change.doc.data().id)
                dispatch(
                  updateStudy({
                    ...(change.doc.data() as StudyMutation),
                  })
                )
              }
              if (change.type === 'removed') {
                console.log('[LiveUpdates] Removed study:', change.doc.data().id)
                dispatch(deleteStudy(change.doc.data().id))
              }
            })
          }

          isFirstSnapshotListener = false
          dispatch(markUserDataSyncCollectionLoaded({ collection: 'studies' }))
        },
        error => {
          console.warn('[LiveUpdates] Studies sync unavailable, using local data', error)
          appLogger.captureError('sync', 'account_sync.studies_subscription_failed', error)
          dispatch(markUserDataSyncCollectionLoaded({ collection: 'studies' }))
        }
      )
    }

    if (enabled && isLogged && isLoading === false) {
      setupListeners()
    } else {
      // Cleanup when user logs out (detected via isLogged change)
      cleanupFirestoreSubscriptions()
    }

    return () => {
      disposed = true
      if (syncFallbackTimeout) {
        clearTimeout(syncFallbackTimeout)
      }
      // Cleanup on unmount
      cleanupFirestoreSubscriptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isLogged, isLoading, resumeToken, user.id])
}

export default useLiveUpdates
