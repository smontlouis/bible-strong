import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as Sentry from '@sentry/react-native'
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
import { subscribeToSubcollection, SUBCOLLECTION_NAMES } from './firestoreSubcollections'
import { checkForEmbeddedData } from './firestoreMigration'
import { useFirestoreMigration } from './useFirestoreMigration'
import { store } from '~redux/store'

let isFirstSnapshotListener = true

const useLiveUpdates = () => {
  const { isLogged, user } = useLogin()
  const isLoggedPrev = usePrevious(isLogged)
  const dispatch = useDispatch()
  const isMigrating = useRef(false)
  const { startMigration } = useFirestoreMigration()

  const isNewlyLogged = isLogged && isLoggedPrev !== isLogged && typeof isLoggedPrev !== 'undefined'

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
      // IMPORTANT: On vérifie les données embedded, pas juste le flag _migrated
      // Car une ancienne app sur un autre appareil peut continuer à synchroniser vers bible.*
      if (!isMigrating.current) {
        isMigrating.current = true
        try {
          const { hasEmbeddedData, collectionsWithData } = await checkForEmbeddedData(user.id)
          if (hasEmbeddedData) {
            console.log(
              '[LiveUpdates] Found embedded data to migrate:',
              collectionsWithData.join(', ')
            )
            // @ts-ignore
            const currentState = store.getState() as RootState
            const result = await startMigration(user.id, currentState)
            if (!result) {
              console.error('[LiveUpdates] Migration failed or incomplete')
              // Continue anyway - the user can use the app with local data
            }
          }
        } catch (error: any) {
          console.error('[LiveUpdates] Migration check failed:', error)
          Sentry.captureException(error, {
            tags: {
              feature: 'firestore_migration',
              action: 'check_embedded_data',
            },
            extra: {
              userId: user.id,
              errorMessage: error?.message,
            },
          })
        }
        isMigrating.current = false
      }

      // Subscribe to user document (settings, subscription, etc.)
      unsuscribeUsers = firebaseDb
        .collection('users')
        .doc(user.id)
        .onSnapshot(doc => {
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

          dispatch(
            receiveLiveUpdates({
              remoteUserData: {
                ...otherUserData,
                bible: otherBible,
                // @ts-ignore
              } as FireStoreUserData,
            })
          )
        })

      // Subscribe to each subcollection
      for (const collection of SUBCOLLECTION_NAMES) {
        const unsubscribe = subscribeToSubcollection(user.id, collection, (data, changes) => {
          console.log(`[LiveUpdates] ${collection} updated:`, Object.keys(data).length, 'items')

          // Dispatch l'update pour cette collection spécifique
          dispatch(
            receiveSubcollectionUpdates({
              collection,
              data,
              isInitialLoad: Object.keys(changes.added).length === Object.keys(data).length,
            })
          )
        })
        subcollectionUnsubscribes.push(unsubscribe)
      }

      // Subscribe to studies collection
      unsuscribeStudies = firebaseDb
        .collection('studies')
        .where('user.id', '==', user.id)
        .onSnapshot(querySnapshot => {
          const source = querySnapshot?.metadata.hasPendingWrites ? 'Local' : 'Server'
          if (source === 'Local' || !querySnapshot) return

          if (isNewlyLogged || !hasStudies) {
            const studies = {} as { [key: string]: Study }
            querySnapshot.forEach(doc => {
              const study = doc.data() as Study
              studies[study.id] = study
            })

            console.log('add all studies')
            dispatch(addStudies(studies))
          } else {
            querySnapshot.docChanges().forEach(change => {
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
      subcollectionUnsubscribes.forEach(unsubscribe => unsubscribe())
    }

    return () => {
      unsuscribeUsers?.()
      unsuscribeStudies?.()
      subcollectionUnsubscribes.forEach(unsubscribe => unsubscribe())
    }
  }, [isLogged, isLoading])
}

export default useLiveUpdates
