import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import {
  addStudies,
  deleteStudy,
  FireStoreUserData,
  receiveLiveUpdates,
  Study,
  StudyMutation,
  updateStudy,
} from '~redux/modules/user'
import { firebaseDb } from './firebase'
import useLogin from './useLogin'
import { usePrevious } from './usePrevious'

let isFirstSnapshotListener = true

const useLiveUpdates = () => {
  const { isLogged, user } = useLogin()
  const isLoggedPrev = usePrevious(isLogged)
  const dispatch = useDispatch()

  const isNewlyLogged =
    isLogged && isLoggedPrev !== isLogged && typeof isLoggedPrev !== 'undefined'

  const isLoading = useSelector((state: RootState) => state.user.isLoading)
  const hasStudies = useSelector(
    (state: RootState) => Object.keys(state.user.bible.studies).length > 0
  )

  useEffect(() => {
    let unsuscribeUsers: (() => void) | undefined
    let unsuscribeStudies: (() => void) | undefined

    if (isLogged && isLoading === false) {
      unsuscribeUsers = firebaseDb
        .collection('users')
        .doc(user.id)
        .onSnapshot(doc => {
          /**
           * Ignore local changes
           */
          const source = doc?.metadata.hasPendingWrites ? 'Local' : 'Server'
          if (source === 'Local' || !doc) return

          const userData = doc.data() as FireStoreUserData | undefined

          if (!userData?.id) {
            return
          }

          dispatch(receiveLiveUpdates({ remoteUserData: userData }))
        })

      unsuscribeStudies = firebaseDb
        .collection('studies')
        .where('user.id', '==', user.id)
        .onSnapshot(querySnapshot => {
          /**
           * Ignore local changes
           */
          const source = querySnapshot?.metadata.hasPendingWrites
            ? 'Local'
            : 'Server'
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
    } else {
      isFirstSnapshotListener = true
      unsuscribeUsers?.()
      unsuscribeStudies?.()
    }
  }, [isLogged, isLoading])
}

export default useLiveUpdates
