import * as firebase from 'firebase'
import 'firebase/firestore'
import * as Segment from 'expo-analytics-segment'
import Sentry from 'sentry-expo'

import { firebaseConfig } from '../../config'

const FireAuth = class {
  init () {
    firebase.initializeApp(firebaseConfig)

    firebase.auth().onAuthStateChanged((user) => {
      if (user && user.isAnonymous) {
        console.log('User exists and is anonymous')

        const uid = user.uid

        firebase.firestore().collection('users').doc(uid).set({
          id: user.uid,
          lastSeen: Date.now()
        })
        if (!__DEV__) {
          Segment.identify(uid)
        }
      } else {
        console.log('No user, need to sign in')

        firebase.auth().signInAnonymously().catch((error) => {
          Sentry.captureException(error)
        })
      }
    })
  }
}

export default new FireAuth()
