import { useEffect, useEffectEvent, useRef } from 'react'
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
import type { QueryDocumentSnapshot, DocumentChange } from '@react-native-firebase/firestore'
import { firebaseDb, doc, collection, query, where, onSnapshot, updateDoc } from './firebase'
import { registerCleanup } from './cleanupRegistry'
import useLogin from './useLogin'
import { usePrevious } from './usePrevious'
import {
  batchWriteSubcollection,
  LIVE_SUBCOLLECTION_NAMES,
  subscribeToSubcollection,
  type SubcollectionData,
} from './firestoreSubcollections'
import { store } from '~redux/store'
import { isMigrationInProgress } from '~state/migration'
import {
  canonicalizeLegacySubcollectionData,
  migrateLegacyPersistedValue,
} from '../migrations/legacyPersistedReferences'
import { appLogger } from './agentObservability'
import { getCurrentAuthUser } from './firebaseAuthRuntime'
import { firestoreSyncOutbox, isPermissionDeniedError } from './firestoreSyncOutbox'
import {
  getPendingStudyTargets,
  getPendingSubcollectionTargets,
  isPendingWriteTarget,
  keepPendingWrites,
  withoutPendingWriteTargets,
} from './pendingWritesOverlay'
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

/**
 * A listener refused because Firebase no longer holds this account (its session ended) is expected:
 * the account stops syncing until the reader signs in again. Only other refusals are reported.
 */
const reportListenerFailure = (
  userId: string,
  event: string,
  error: unknown,
  payload?: Record<string, string>
) => {
  if (isPermissionDeniedError(error) && getCurrentAuthUser()?.uid !== userId) {
    appLogger.warn('sync', `${event}.signed_out`, payload)
    return
  }
  appLogger.captureError('sync', event, error, payload)
}

interface AccountMigrationCoordinator {
  enabled: boolean
  runBeforeSync(userId: string, state: RootState): Promise<boolean>
  resumeToken: number
}

const useLiveUpdates = ({ enabled, runBeforeSync, resumeToken }: AccountMigrationCoordinator) => {
  // While the session is lost, nothing comes from the server and the queue waits for the account.
  const { isLogged, isSessionLost, user } = useLogin()
  const isLoggedPrev = usePrevious(isLogged)
  const dispatch = useDispatch()
  const migrationRunRef = useRef<Promise<boolean> | undefined>(undefined)
  const migrationRunnerRef = useRef(runBeforeSync)
  const connectionStatus = useConnectionStatus()

  useEffect(() => {
    migrationRunnerRef.current = runBeforeSync
  }, [runBeforeSync])

  const isNewlyLogged = isLogged && isLoggedPrev !== isLogged && typeof isLoggedPrev !== 'undefined'

  const isLoading = useSelector((state: RootState) => state.user.isLoading)
  const hasStudies = useSelector(
    (state: RootState) => Object.keys(state.user.bible.studies).length > 0
  )
  const readStudiesSyncMode = useEffectEvent(() => ({ isNewlyLogged, hasStudies }))
  const readConnectionStatus = useEffectEvent(() => connectionStatus)

  useEffect(() => {
    if (!enabled || !isLogged || isSessionLost || !user.id || connectionStatus !== 'internet')
      return
    firestoreSyncOutbox.resumeReplay(user.id)
    void firestoreSyncOutbox.replay(user.id)
    return () => firestoreSyncOutbox.cancelReplay(user.id)
  }, [connectionStatus, enabled, isLogged, isSessionLost, user.id])

  useEffect(() => {
    // Captured when the listeners are set up: the studies callback keeps these values
    // for the whole subscription instead of following later renders.
    const studiesSyncMode = readStudiesSyncMode()
    // Use module-level variables for cleanup access before logout
    currentUnsubscribeUsers = undefined
    currentUnsubscribeStudies = undefined
    currentSubcollectionUnsubscribes = []
    let syncFallbackTimeout: ReturnType<typeof setTimeout> | undefined
    let slowSyncReportTimeout: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    const authoritativeSubcollections = new Set<string>()
    // Collections whose listener answered, from the server, the cache or local pending writes.
    const answeredCollections = new Set<UserDataSyncCollection>()
    const markCollectionAnswered = (collection: UserDataSyncCollection) => {
      answeredCollections.add(collection)
      dispatch(markUserDataSyncCollectionLoaded({ collection }))
    }

    const setupListeners = async () => {
      if (!enabled || !isLogged || isSessionLost || isLoading !== false || !user.id) {
        return
      }
      const userId = user.id

      dispatch(startUserDataSync())
      const syncStartedAt = Date.now()
      // Screens waiting for the account data stop waiting after this delay, migrations included.
      syncFallbackTimeout = setTimeout(() => {
        const sync = store.getState().user.sync
        if (!sync?.isLoading) {
          return
        }

        console.warn('[LiveUpdates] User data sync timed out, keeping local data visible')
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
      const accountMigrationDurationMs = Date.now() - syncStartedAt

      // Only the listeners are measured: the migration check before them has its own reports.
      slowSyncReportTimeout = setTimeout(() => {
        const missingCollections = TRACKED_SYNC_COLLECTIONS.filter(
          collection => !answeredCollections.has(collection)
        )
        if (!missingCollections.length) return

        appLogger.captureError(
          'sync',
          'account_sync.initial_load_timeout',
          new Error('ACCOUNT_SYNC_INITIAL_LOAD_TIMEOUT'),
          {
            timeoutMs: SYNC_FALLBACK_TIMEOUT_MS,
            missingCollections,
            accountMigrationDurationMs,
            connectionStatus: readConnectionStatus(),
          }
        )
      }, SYNC_FALLBACK_TIMEOUT_MS)

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
      for (const collection of LIVE_SUBCOLLECTION_NAMES) {
        const unsubscribe = subscribeToSubcollection(
          userId,
          collection,
          (data, changes) => {
            if (isTrackedSyncCollection(collection)) answeredCollections.add(collection)
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

            const isInitialLoad =
              isFirstAuthoritativeSnapshot ||
              (changes.fromCache &&
                Object.keys(canonicalAdded).length === Object.keys(canonical.data).length)
            const pending = getPendingSubcollectionTargets(
              firestoreSyncOutbox.getPending(userId),
              collection
            )
            const localCollection = (
              store.getState().user.bible as unknown as Record<
                string,
                SubcollectionData | undefined
              >
            )[collection]

            // Dispatch l'update pour cette collection spécifique
            dispatch(
              receiveSubcollectionUpdates({
                collection,
                data: keepPendingWrites(
                  canonical.data as SubcollectionData,
                  localCollection,
                  pending
                ),
                changes: {
                  added: withoutPendingWriteTargets(canonicalAdded as SubcollectionData, pending),
                  modified: withoutPendingWriteTargets(
                    canonicalModified as SubcollectionData,
                    pending
                  ),
                  removed: changes.removed.filter(id => !isPendingWriteTarget(pending, id)),
                },
                isInitialLoad,
                fromCache: changes.fromCache,
              })
            )
          },
          error => {
            console.warn(`[LiveUpdates] ${collection} sync unavailable, using local data`, error)
            reportListenerFailure(userId, 'account_sync.subscription_failed', error, {
              collection,
            })
            if (isTrackedSyncCollection(collection)) markCollectionAnswered(collection)
          },
          {
            includeMetadataChanges: true,
            // Local writes not yet confirmed hold back the snapshot, not the screens: the store
            // already shows them.
            onPendingWrites: () => {
              if (isTrackedSyncCollection(collection) && !answeredCollections.has(collection)) {
                markCollectionAnswered(collection)
              }
            },
          }
        )
        currentSubcollectionUnsubscribes.push(unsubscribe)
      }

      // Subscribe to studies collection
      currentUnsubscribeStudies = onSnapshot(
        query(collection(firebaseDb, 'studies'), where('user.id', '==', userId)),
        querySnapshot => {
          const source = querySnapshot?.metadata.hasPendingWrites ? 'Local' : 'Server'
          if (source === 'Local' && !answeredCollections.has('studies')) {
            markCollectionAnswered('studies')
          }
          if (source === 'Local' || !querySnapshot) return

          // A study a queued write will still change keeps its local value (a refused or
          // signed-out write is not in Firestore yet).
          const pendingStudies = getPendingStudyTargets(firestoreSyncOutbox.getPending(userId))
          if (studiesSyncMode.isNewlyLogged || !studiesSyncMode.hasStudies) {
            const studies = {} as { [key: string]: Study }
            querySnapshot.forEach((docSnap: QueryDocumentSnapshot) => {
              const study = docSnap.data() as Study
              studies[study.id] = study
            })

            console.log('[LiveUpdates] Add all studies')
            dispatch(
              addStudies(
                keepPendingWrites(studies, store.getState().user.bible.studies, pendingStudies)
              )
            )
          } else {
            querySnapshot.docChanges().forEach((change: DocumentChange) => {
              // Ignore first listener adding all documents
              if (isFirstSnapshotListener) return
              if (isPendingWriteTarget(pendingStudies, change.doc.id)) return

              // Already in Firestore: the store takes them without writing them back.
              if (change.type === 'added') {
                console.log('[LiveUpdates] Added study:', change.doc.data().id)

                dispatch(
                  updateStudy(
                    {
                      ...(change.doc.data() as StudyMutation),
                    },
                    { localOnly: true }
                  )
                )
              }
              if (change.type === 'modified') {
                console.log('[LiveUpdates] Modified study:', change.doc.data().id)
                dispatch(
                  updateStudy(
                    {
                      ...(change.doc.data() as StudyMutation),
                    },
                    { localOnly: true }
                  )
                )
              }
              if (change.type === 'removed') {
                console.log('[LiveUpdates] Removed study:', change.doc.data().id)
                dispatch(deleteStudy(change.doc.data().id, { localOnly: true }))
              }
            })
          }

          isFirstSnapshotListener = false
          markCollectionAnswered('studies')
        },
        error => {
          console.warn('[LiveUpdates] Studies sync unavailable, using local data', error)
          reportListenerFailure(userId, 'account_sync.studies_subscription_failed', error)
          markCollectionAnswered('studies')
        }
      )
    }

    if (enabled && isLogged && !isSessionLost && isLoading === false) {
      setupListeners()
    } else {
      // Cleanup when user logs out (detected via isLogged change)
      cleanupFirestoreSubscriptions()
      // A session lost during the first sync: the local data is all there is until the reader
      // signs in again, so the screens stop waiting for the server.
      if (isSessionLost && store.getState().user.sync?.isLoading) {
        dispatch(finishUserDataSync())
      }
    }

    return () => {
      disposed = true
      if (syncFallbackTimeout) {
        clearTimeout(syncFallbackTimeout)
      }
      if (slowSyncReportTimeout) {
        clearTimeout(slowSyncReportTimeout)
      }
      // Cleanup on unmount
      cleanupFirestoreSubscriptions()
    }
    // resumeToken only restarts the subscription; dispatch is the store's stable dispatch.
  }, [enabled, isLogged, isSessionLost, isLoading, resumeToken, user.id, dispatch])
}

export default useLiveUpdates
