import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import {
  deleteStudy,
  FireStoreUserData,
  receiveLiveUpdates,
  StudyMutation,
  updateStudy,
} from '~redux/modules/user'
import { firebaseDb } from './firebase'
import useLogin from './useLogin'

let isFirstSnapshotListener = true

const useLiveUpdates = () => {
  const { isLogged, user } = useLogin()
  const dispatch = useDispatch()

  const isLoading = useSelector((state: RootState) => state.user.isLoading)

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

          const userData = doc.data() as FireStoreUserData

          return dispatch(receiveLiveUpdates({ remoteUserData: userData }))
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

          querySnapshot.docChanges().forEach(change => {
            // Ignore first listener adding all documents
            if (isFirstSnapshotListener) return

            if (change.type === 'added') {
              dispatch(
                updateStudy({
                  ...(change.doc.data() as StudyMutation),
                })
              )
            }
            if (change.type === 'modified') {
              dispatch(
                updateStudy({
                  ...(change.doc.data() as StudyMutation),
                })
              )
            }
            if (change.type === 'removed') {
              dispatch(deleteStudy(change.doc.data().id))
            }
          })

          isFirstSnapshotListener = false
        })
    } else {
      unsuscribeUsers?.()
      unsuscribeStudies?.()
    }
  }, [isLogged, isLoading])
}

export default useLiveUpdates
