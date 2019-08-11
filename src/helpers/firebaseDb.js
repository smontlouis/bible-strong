import * as firebase from 'firebase'
import 'firebase/firestore'
import { firebaseConfig } from '../../config'

export const firebaseDb = firebase.initializeApp(firebaseConfig).firestore()
