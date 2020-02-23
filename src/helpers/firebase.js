import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'

export const firebaseDb = firestore()
export const storageRef = storage().ref()
