import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import {
  createStudy,
  deleteStudy,
  FireStoreUserData,
  receiveLiveUpdates,
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

    console.log({ isLogged, isLoading })

    if (isLogged && isLoading === false) {
      unsuscribeUsers = firebaseDb
        .collection('users')
        .doc(user.id)
        .onSnapshot(doc => {
          const source = doc?.metadata.hasPendingWrites ? 'Local' : 'Server'

          /**
           * Ignore local changes
           */
          if (source === 'Local' || !doc) return

          console.log('await 3.b received live update')
          const userData = doc.data() as FireStoreUserData

          return dispatch(receiveLiveUpdates({ remoteUserData: userData }))
        })

      unsuscribeStudies = firebaseDb
        .collection('studies')
        .where('user.id', '==', user.id)
        .onSnapshot(querySnapshot => {
          const source = querySnapshot?.metadata.hasPendingWrites
            ? 'Local'
            : 'Server'
          if (source === 'Local' || !querySnapshot) return

          querySnapshot.docChanges().forEach(change => {
            // Ignore first listener adding all documents
            if (isFirstSnapshotListener) return

            if (change.type === 'added') {
              console.log('New study: ', change.doc.data().id)
              dispatch(
                createStudy({
                  id: change.doc.data().id,
                  content: change.doc.data().content,
                  title: change.doc.data().title,
                  updateRemote: false,
                })
              )
            }
            if (change.type === 'modified') {
              console.log('Modified study: ', change.doc.data().id)
              dispatch(
                updateStudy({
                  id: change.doc.data().id,
                  content: change.doc.data().content,
                  title: change.doc.data().title,
                  tags: change.doc.data().tags,
                  updateRemote: false,
                })
              )
            }
            if (change.type === 'removed') {
              console.log('Removed study: ', change.doc.data().id)
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
