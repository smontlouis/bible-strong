import { useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import {
  addStudies,
  deleteStudy,
  type FireStoreUserData,
  receiveLiveUpdates,
  receiveSubcollectionUpdates,
  type Study,
  type StudyMutation,
  updateStudy,
} from '~redux/modules/user'
import { firebaseDb } from './firebase'
import useLogin from './useLogin'
import { usePrevious } from './usePrevious'
import {
  subscribeToSubcollection,
  SUBCOLLECTION_NAMES,
} from './firestoreSubcollections'
import { migrateUserDataToSubcollections, isUserMigrated } from './firestoreMigration'
import { store } from '~redux/store'

let isFirstSnapshotListener = true

const useLiveUpdates = () => {
  const { isLogged, user } = useLogin()
  const isLoggedPrev = usePrevious(isLogged)
  const dispatch = useDispatch()
  const isMigrating = useRef(false)

  const isNewlyLogged =
    isLogged && isLoggedPrev !== isLogged && typeof isLoggedPrev !== 'undefined'

  const isLoading = useSelector((state: RootState) => state.user.isLoading)
  const hasStudies = useSelector(
    (state: RootState) => Object.keys(state.user.bible.studies).length > 0
  )

  useEffect(() => {
    let unsuscribeUsers: (() => void) | undefined
    let unsuscribeStudies: (() => void) | undefined
    const subcollectionUnsubscribes: (() => void)[] = []

    const setupListeners = async () => {
      if (!isLogged || isLoading !== false || !user.id) {
        return
      }

      // Vérifier et effectuer la migration si nécessaire
      if (!isMigrating.current) {
        isMigrating.current = true
        try {
          const migrated = await isUserMigrated(user.id)
          if (!migrated) {
            console.log('[LiveUpdates] User not migrated, starting migration...')
            const currentState = store.getState()
            const result = await migrateUserDataToSubcollections(
              user.id,
              currentState,
              (message, progress) => {
                console.log(`[Migration] ${message} (${Math.round(progress * 100)}%)`)
              }
            )
            if (!result.success) {
              console.error('[LiveUpdates] Migration failed:', result.error)
              // Continue anyway - the user can use the app with local data
            }
          }
        } catch (error) {
          console.error('[LiveUpdates] Migration check failed:', error)
        }
        isMigrating.current = false
      }

      // Subscribe to user document (settings, subscription, etc.)
      unsuscribeUsers = firebaseDb
        .collection('users')
        .doc(user.id)
        .onSnapshot((doc) => {
          const source = doc?.metadata.hasPendingWrites ? 'Local' : 'Server'
          if (source === 'Local' || !doc) return

          const userData = doc.data() as FireStoreUserData | undefined

          if (!userData?.id) {
            return
          }

          // Ne pas inclure les sous-collections dans les live updates
          // Elles sont gérées séparément
          const { bible, ...otherUserData } = userData
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { highlights: _h, notes: _n, tags: _t, strongsHebreu: _sh, strongsGrec: _sg, words: _w, naves: _nv, ...otherBible } = bible || {}

          dispatch(
            receiveLiveUpdates({
              remoteUserData: {
                ...otherUserData,
                bible: otherBible,
              } as FireStoreUserData,
            })
          )
        })

      // Subscribe to each subcollection
      for (const collection of SUBCOLLECTION_NAMES) {
        const unsubscribe = subscribeToSubcollection(
          user.id,
          collection,
          (data, changes) => {
            console.log(
              `[LiveUpdates] ${collection} updated:`,
              Object.keys(data).length,
              'items'
            )

            // Dispatch l'update pour cette collection spécifique
            dispatch(
              receiveSubcollectionUpdates({
                collection,
                data,
                isInitialLoad: Object.keys(changes.added).length === Object.keys(data).length,
              })
            )
          }
        )
        subcollectionUnsubscribes.push(unsubscribe)
      }

      // Subscribe to studies collection
      unsuscribeStudies = firebaseDb
        .collection('studies')
        .where('user.id', '==', user.id)
        .onSnapshot((querySnapshot) => {
          const source = querySnapshot?.metadata.hasPendingWrites
            ? 'Local'
            : 'Server'
          if (source === 'Local' || !querySnapshot) return

          if (isNewlyLogged || !hasStudies) {
            const studies = {} as { [key: string]: Study }
            querySnapshot.forEach((doc) => {
              const study = doc.data() as Study
              studies[study.id] = study
            })

            console.log('add all studies')
            dispatch(addStudies(studies))
          } else {
            querySnapshot.docChanges().forEach((change) => {
              // Ignore first listener adding all documents
              if (isFirstSnapshotListener) return

              if (change.type === 'added') {
                console.log('added study: ', change.doc.data().id)

                dispatch(
                  updateStudy({
                    ...(change.doc.data() as StudyMutation),
                  })
                )
              }
              if (change.type === 'modified') {
                console.log('modified study: ', change.doc.data().id)
                dispatch(
                  updateStudy({
                    ...(change.doc.data() as StudyMutation),
                  })
                )
              }
              if (change.type === 'removed') {
                console.log('removed study: ', change.doc.data().id)
                dispatch(deleteStudy(change.doc.data().id))
              }
            })
          }

          isFirstSnapshotListener = false
        })
    }

    if (isLogged && isLoading === false) {
      setupListeners()
    } else {
      isFirstSnapshotListener = true
      unsuscribeUsers?.()
      unsuscribeStudies?.()
      subcollectionUnsubscribes.forEach((unsubscribe) => unsubscribe())
    }

    return () => {
      unsuscribeUsers?.()
      unsuscribeStudies?.()
      subcollectionUnsubscribes.forEach((unsubscribe) => unsubscribe())
    }
  }, [isLogged, isLoading])
}

export default useLiveUpdates
