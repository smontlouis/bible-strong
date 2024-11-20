import { initializeApp } from '@react-native-firebase/app'
import { Platform } from 'react-native'

// Initialize Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyAuLacmYeJAZKRWQx272U0RZCY4uwshtZg',
  authDomain: 'bible-strong-app.firebaseapp.com',
  projectId: 'bible-strong-app',
  storageBucket: 'bible-strong-app.appspot.com',
  messagingSenderId: '204116128917',
  appId:
    Platform.OS === 'ios'
      ? '1:204116128917:ios:253ce7fa4e328e2702579c'
      : '1:204116128917:android:253ce7fa4e328e2702579c',
}

const app = initializeApp(firebaseConfig)
// For more information on how to access Firebase in your project,
// see the Firebase documentation: https://firebase.google.com/docs/web/setup#access-firebase

export default app
