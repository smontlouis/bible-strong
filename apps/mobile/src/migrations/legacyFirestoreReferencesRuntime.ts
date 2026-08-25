import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'

import { firebaseDb, doc, getDoc, getDocs, setDoc } from '~helpers/firebase'
import {
  getSubcollectionRef,
  writeAllToSubcollection,
  type SubcollectionData,
  type SubcollectionName,
} from '~helpers/firestoreSubcollections'

import { FIRESTORE_LEGACY_REFERENCE_SUBCOLLECTIONS } from './accountMigrationRegistry'
import {
  createLegacyFirestoreReferencesAdapter,
  type LegacyFirestoreReferencesPersistence,
} from './legacyFirestoreReferences'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const decodeDocumentId = (documentId: string): string => documentId.replace(/__SLASH__/g, '/')

const INSPECTION_TIMEOUT_MS = 10_000

const withInspectionTimeout = async <T>(operation: Promise<T>): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('APP_MIGRATION_ACCOUNT_INSPECTION_TIMEOUT')),
          INSPECTION_TIMEOUT_MS
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

const persistence: LegacyFirestoreReferencesPersistence = {
  async readUserSettings(userId) {
    const snapshot = await withInspectionTimeout(getDoc(doc(firebaseDb, 'users', userId)))
    const bible = snapshot.data()?.bible
    return isRecord(bible) ? bible.settings : undefined
  },
  async writeUserSettings(userId, settings) {
    await setDoc(doc(firebaseDb, 'users', userId), { bible: { settings } }, { merge: true })
  },
  async readSubcollection(userId, collection) {
    const snapshot = await withInspectionTimeout(getDocs(getSubcollectionRef(userId, collection)))
    const documents: Record<string, unknown> = {}
    snapshot.docs.forEach((document: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      documents[decodeDocumentId(document.id)] = document.data()
    })
    return documents
  },
  async writeSubcollection(userId, collection, documents) {
    await writeAllToSubcollection(
      userId,
      collection as SubcollectionName,
      documents as SubcollectionData
    )
  },
}

export const legacyFirestoreReferencesAdapter = createLegacyFirestoreReferencesAdapter(
  persistence,
  FIRESTORE_LEGACY_REFERENCE_SUBCOLLECTIONS
)
