import * as firebase from 'firebase'
import 'firebase/firestore'
import Sentry from 'sentry-expo'

import { firebaseConfig } from '../../config'

const FireAuth = class {
  init () {
    firebase.initializeApp(firebaseConfig)

    firebase.auth().signInAnonymously().catch((error) => {
      Sentry.captureException(error)
    })

    firebase.auth().onAuthStateChanged((user) => {
      if (user && user.isAnonymous) {
        const uid = user.uid

        firebase.firestore().collection('users').doc(uid).set({
          id: user.uid,
          lastSeen: Date.now()
        })
      }
    })
  }
}

export default new FireAuth()
