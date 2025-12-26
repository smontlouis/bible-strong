// Web shim for @react-native-firebase/firestore
// Uses Firebase JS SDK instead of native module

import { firebaseApp } from './firebase-web-init'
import {
  getFirestore as getFirestoreWeb,
  collection as collectionWeb,
  doc as docWeb,
  setDoc as setDocWeb,
  getDoc as getDocWeb,
  getDocs as getDocsWeb,
  updateDoc as updateDocWeb,
  deleteDoc as deleteDocWeb,
  onSnapshot as onSnapshotWeb,
  writeBatch as writeBatchWeb,
  query as queryWeb,
  where as whereWeb,
  orderBy as orderByWeb,
  limit as limitWeb,
  startAfter as startAfterWeb,
  increment as incrementWeb,
  deleteField as deleteFieldWeb,
  DocumentReference,
  CollectionReference,
  Query,
} from 'firebase/firestore'

// Get the Firestore instance
const firestoreInstance = getFirestoreWeb(firebaseApp)

// Export getFirestore that returns the actual instance
export const getFirestore = () => firestoreInstance

// Re-export modular functions (pass through firebaseInstance where needed)
export const collection = (...args: [any, string, ...string[]]) => {
  const [, ...pathSegments] = args
  return collectionWeb(firestoreInstance, ...pathSegments)
}

export const doc = (...args: [any, string, ...string[]]) => {
  const [, ...pathSegments] = args
  return docWeb(firestoreInstance, ...pathSegments)
}

export const setDoc = setDocWeb
export const getDoc = getDocWeb
export const getDocs = getDocsWeb
export const updateDoc = updateDocWeb
export const deleteDoc = deleteDocWeb
export const onSnapshot = onSnapshotWeb
export const writeBatch = () => writeBatchWeb(firestoreInstance)
export const query = queryWeb
export const where = whereWeb
export const orderBy = orderByWeb
export const limit = limitWeb
export const startAfter = startAfterWeb
export const increment = incrementWeb
export const deleteField = deleteFieldWeb

// Type exports for compatibility
export type FirebaseFirestoreTypes = {
  DocumentSnapshot: any
  QuerySnapshot: any
  DocumentReference: DocumentReference
  CollectionReference: CollectionReference
  Query: Query
  WriteBatch: any
}

export default {
  getFirestore,
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
  increment,
  deleteField,
}
