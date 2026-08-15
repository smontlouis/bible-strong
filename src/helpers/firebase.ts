import {
  getFirestore,
  increment as firestoreIncrement,
  deleteField as firestoreDeleteField,
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
  waitForPendingWrites,
} from '@react-native-firebase/firestore'
import { getStorage, ref } from '@react-native-firebase/storage'
import { getLanguage } from '~i18n'
import { ResourceLanguage, DatabaseId, isSharedDB } from '~helpers/databaseTypes'
import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  getMobileResourceCatalogEntry,
} from '~helpers/mobileResourceCatalog'

// Firebase instances (modular API)
export const firebaseDb = getFirestore()
export const storageRef = ref(getStorage())
export const increment = firestoreIncrement(1)

// Re-export modular Firestore functions for use in other files
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
  firestoreDeleteField as deleteField,
  firestoreIncrement,
  waitForPendingWrites,
}

export const CDN_URL = 'https://assets.bible-strong.app/'
export const CDN_FALLBACK_URL = 'https://storage.googleapis.com/bible-strong-app.appspot.com/'
export const cdnUrl = (path: string) => `${CDN_URL}${path}`
export const getCdnFallbackUrl = (url: string) =>
  url.startsWith(CDN_URL) ? `${CDN_FALLBACK_URL}${url.slice(CDN_URL.length)}` : null

// French database URLs
export const databasesRef = {
  MHY: getMobileResourceCatalogEntry('database:MHY:fr').url,
  TRESOR: getMobileResourceCatalogEntry('database:TRESOR:fr').url,
  DICTIONNAIRE: getMobileResourceCatalogEntry('database:DICTIONNAIRE:fr').url,
  NAVE: getMobileResourceCatalogEntry('database:NAVE:fr').url,
  TIMELINE: getMobileResourceCatalogEntry('database:TIMELINE:fr').url,
}

// English database URLs
export const databasesEnRef: Partial<Record<RemoteDatabaseId, string>> = {
  TRESOR: getMobileResourceCatalogEntry('database:TRESOR:fr').url,
  DICTIONNAIRE: getMobileResourceCatalogEntry('database:DICTIONNAIRE:en').url,
  NAVE: getMobileResourceCatalogEntry('database:NAVE:en').url,
  TIMELINE: getMobileResourceCatalogEntry('database:TIMELINE:en').url,
}

// Database IDs that have remote URLs (excludes BIBLES which is local-only)
type RemoteDatabaseId = Exclude<DatabaseId, 'BIBLES'>
type DatabasesRef = Partial<Record<RemoteDatabaseId, string>>

// Get database URL for a specific database and language
export const getDatabaseUrl = (dbId: RemoteDatabaseId, lang: ResourceLanguage): string => {
  const resourceLang = isSharedDB(dbId) ? 'fr' : lang
  return getMobileResourceCatalogEntry(`database:${dbId}:${resourceLang}`).url
}

// Legacy function for backward compatibility
export const getDatabasesRef = (): DatabasesRef => {
  if (getLanguage() === 'fr') {
    return databasesRef
  }

  return databasesEnRef
}

// Get all database URLs for a specific language
export const getDatabasesRefForLang = (lang: ResourceLanguage): DatabasesRef => {
  if (lang === 'fr') {
    return databasesRef
  }

  return databasesEnRef
}

export const biblesRef: {
  [version: string]: string
} = Object.fromEntries(
  Object.entries(BUNDLED_MOBILE_RESOURCE_CATALOG.resources).flatMap(([id, resource]) =>
    id.startsWith('bible:') ? [[id.slice('bible:'.length), resource.url]] : []
  )
)
