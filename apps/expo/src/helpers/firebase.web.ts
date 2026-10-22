import {
  collection,
  deleteDoc,
  deleteField as firestoreDeleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment as firestoreIncrement,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getStorage, ref } from 'firebase/storage'

import type { ResourceLanguage, DatabaseId } from '~helpers/databaseTypes'
import { firebaseApp } from './firebaseApp.web'

// The cache survives reloads, as in the native apps: a listener attached again within 30 minutes
// is billed only for the documents that changed, instead of the whole account.
const createFirestore = () => {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // Already started for this app, for instance when the module is evaluated again.
    return getFirestore(firebaseApp)
  }
}

export const firebaseDb = createFirestore()
export const storageRef = ref(getStorage(firebaseApp))
export const increment = firestoreIncrement(1)

export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  firestoreDeleteField as deleteField,
  firestoreIncrement,
  waitForPendingWrites,
}

export const CDN_URL = 'https://assets.bible-strong.app/'
export const CDN_FALLBACK_URL = 'https://storage.googleapis.com/bible-strong-app.appspot.com/'
export const cdnUrl = (path: string) => `${CDN_URL}${path}`
export const getCdnFallbackUrl = (url: string) =>
  url.startsWith(CDN_URL) ? `${CDN_FALLBACK_URL}${url.slice(CDN_URL.length)}` : null

type RemoteDatabaseId = Exclude<DatabaseId, 'BIBLES'>
type DatabasesRef = Partial<Record<RemoteDatabaseId, string>>

const onlineOnlyResourceError = () => new Error('WEB_ONLINE_ONLY')

export const databasesRef: DatabasesRef = {}
export const databasesEnRef: DatabasesRef = {}
export const getDatabaseUrl = (_dbId: RemoteDatabaseId, _lang: ResourceLanguage): string => {
  throw onlineOnlyResourceError()
}
export const getDatabasesRef = (): DatabasesRef => databasesRef
export const getDatabasesRefForLang = (_lang: ResourceLanguage): DatabasesRef => databasesRef
export const biblesRef: Record<string, string> = {}
