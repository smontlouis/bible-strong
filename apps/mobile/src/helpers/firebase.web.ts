import {
  collection,
  deleteDoc,
  deleteField as firestoreDeleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment as firestoreIncrement,
  onSnapshot,
  query,
  setDoc,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getStorage, ref } from 'firebase/storage'

import type { ResourceLanguage, DatabaseId } from '~helpers/databaseTypes'
import { firebaseApp } from './firebaseApp.web'

export const firebaseDb = getFirestore(firebaseApp)
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
