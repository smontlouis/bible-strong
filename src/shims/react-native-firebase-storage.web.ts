// Web shim for @react-native-firebase/storage
// Uses Firebase JS SDK instead of native module

import { firebaseApp } from './firebase-web-init'
import {
  getStorage as getStorageWeb,
  ref as refWeb,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'

// Re-export everything from Firebase JS SDK
export const getStorage = () => getStorageWeb(firebaseApp)
export const ref = refWeb

export { uploadBytes, getDownloadURL, deleteObject }

export default {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
}
