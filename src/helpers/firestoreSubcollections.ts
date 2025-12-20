import * as Sentry from '@sentry/react-native'
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import {
  firebaseDb,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from './firebase'

/**
 * Types pour les sous-collections
 */
export type SubcollectionName =
  | 'bookmarks'
  | 'highlights'
  | 'notes'
  | 'tags'
  | 'strongsHebreu'
  | 'strongsGrec'
  | 'words'
  | 'naves'

export const SUBCOLLECTION_NAMES: SubcollectionName[] = [
  'bookmarks',
  'highlights',
  'notes',
  'tags',
  'strongsHebreu',
  'strongsGrec',
  'words',
  'naves',
]

/**
 * Taille maximale d'un batch Firestore (on utilise 400 pour avoir de la marge)
 */
const BATCH_CHUNK_SIZE = 400

/**
 * Résultat de la validation d'un ID de document
 */
interface ValidationResult {
  valid: boolean
  reason?: 'empty' | 'reserved_name' | 'too_long'
}

/**
 * Encode un ID de document pour Firestore (remplace / par __SLASH__)
 * Nécessaire car les IDs avec / sont utilisés pour les notes multi-versets
 */
function encodeDocumentId(docId: string): string {
  return docId.replace(/\//g, '__SLASH__')
}

/**
 * Decode un ID de document depuis Firestore
 */
function decodeDocumentId(docId: string): string {
  return docId.replace(/__SLASH__/g, '/')
}

/**
 * Valide un ID de document Firestore et retourne la raison si invalide
 * Note: Les slashs sont autorisés car ils seront encodés avant écriture
 */
function validateDocumentId(docId: string): ValidationResult {
  if (!docId || docId.length === 0) return { valid: false, reason: 'empty' }
  if (docId === '.' || docId === '..') return { valid: false, reason: 'reserved_name' }
  // Slashs autorisés - ils seront encodés en __SLASH__ avant écriture
  // Check for reasonable length (Firestore limit is 1500 bytes)
  if (docId.length > 1500) return { valid: false, reason: 'too_long' }
  return { valid: true }
}

/**
 * Obtient une référence à une sous-collection
 */
export function getSubcollectionRef(userId: string, collectionName: SubcollectionName) {
  return collection(firebaseDb, 'users', userId, collectionName)
}

/**
 * Écrit un document dans une sous-collection
 */
export async function writeToSubcollection(
  userId: string,
  collectionName: SubcollectionName,
  docId: string,
  data: any
): Promise<void> {
  try {
    const docRef = doc(getSubcollectionRef(userId, collectionName), encodeDocumentId(docId))
    await setDoc(docRef, data, { merge: true })
  } catch (error) {
    console.error(`[Subcollections] Failed to write to ${collectionName}/${docId}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'write', collection: collectionName },
      extra: { userId, docId },
    })
    throw error
  }
}

/**
 * Supprime un document d'une sous-collection
 */
export async function deleteFromSubcollection(
  userId: string,
  collectionName: SubcollectionName,
  docId: string
): Promise<void> {
  try {
    const docRef = doc(getSubcollectionRef(userId, collectionName), encodeDocumentId(docId))
    await deleteDoc(docRef)
  } catch (error) {
    console.error(`[Subcollections] Failed to delete from ${collectionName}/${docId}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'delete', collection: collectionName },
      extra: { userId, docId },
    })
    throw error
  }
}

/**
 * Interface pour les changements à appliquer en batch
 */
export interface BatchChanges {
  set: { [docId: string]: any }
  delete: string[]
}

/**
 * Callback pour le suivi de progression des chunks
 */
export type ChunkProgressCallback = (chunkIndex: number, totalChunks: number) => void

/**
 * Écrit plusieurs documents en batch avec chunking automatique
 * Gère les batchs de plus de 500 opérations
 */
export async function batchWriteSubcollection(
  userId: string,
  collectionName: SubcollectionName,
  changes: BatchChanges,
  onChunkProgress?: ChunkProgressCallback
): Promise<void> {
  const collectionRef = getSubcollectionRef(userId, collectionName)

  // Préparer toutes les opérations
  const operations: { type: 'set' | 'delete'; docId: string; data?: any }[] = []
  const skippedItems: { docId: string; reason: string }[] = []

  // Ajouter les opérations set (avec validation et encodage des IDs)
  for (const [docId, data] of Object.entries(changes.set)) {
    const validation = validateDocumentId(docId)
    if (validation.valid) {
      operations.push({ type: 'set', docId: encodeDocumentId(docId), data })
    } else {
      skippedItems.push({ docId: docId || '(empty)', reason: validation.reason! })
    }
  }

  // Ajouter les opérations delete (avec validation et encodage des IDs)
  for (const docId of changes.delete) {
    const validation = validateDocumentId(docId)
    if (validation.valid) {
      operations.push({ type: 'delete', docId: encodeDocumentId(docId) })
    } else {
      skippedItems.push({ docId: docId || '(empty)', reason: validation.reason! })
    }
  }

  // Enhanced logging: show ALL skipped items grouped by reason
  if (skippedItems.length > 0) {
    console.warn(
      `[Subcollections] ⚠️ Skipped ${skippedItems.length} invalid document(s) in ${collectionName}:`
    )

    // Group by reason for clearer output
    const byReason: { [reason: string]: string[] } = {}
    for (const item of skippedItems) {
      if (!byReason[item.reason]) byReason[item.reason] = []
      byReason[item.reason].push(item.docId)
    }

    for (const [reason, docIds] of Object.entries(byReason)) {
      console.warn(`[Subcollections]   - ${reason}: ${docIds.length} item(s)`)
      // Show first 10 IDs for each reason (for debugging)
      if (docIds.length <= 10) {
        console.warn(`[Subcollections]     IDs: ${docIds.join(', ')}`)
      } else {
        console.warn(
          `[Subcollections]     IDs: ${docIds.slice(0, 10).join(', ')} ... and ${docIds.length - 10} more`
        )
      }
    }
  }

  if (operations.length === 0) {
    return
  }

  // Découper en chunks
  const chunks: (typeof operations)[] = []
  for (let i = 0; i < operations.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(operations.slice(i, i + BATCH_CHUNK_SIZE))
  }

  console.log(
    `[Subcollections] Batch write to ${collectionName}: ${operations.length} ops in ${chunks.length} chunk(s)`
  )

  try {
    // Exécuter chaque chunk séquentiellement
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const batch = writeBatch(firebaseDb)

      for (const op of chunk) {
        const docRef = doc(collectionRef, op.docId)
        if (op.type === 'set') {
          batch.set(docRef, op.data, { merge: true })
        } else {
          batch.delete(docRef)
        }
      }

      await batch.commit()
      const setOps = chunk.filter(op => op.type === 'set').length
      const deleteOps = chunk.filter(op => op.type === 'delete').length
      console.log(
        `[Subcollections] Chunk ${i + 1}/${chunks.length} committed (${setOps} SET, ${deleteOps} DELETE)`
      )

      // Report chunk progress
      onChunkProgress?.(i + 1, chunks.length)
    }

    // Final summary
    const totalSkipped = skippedItems.length
    const totalProcessed = operations.length
    console.log(
      `[Subcollections] ✅ ${collectionName} batch complete: ${totalProcessed} processed, ${totalSkipped} skipped`
    )
  } catch (error) {
    console.error(`[Subcollections] Batch write failed for ${collectionName}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'batch_write', collection: collectionName },
      extra: { userId, operationsCount: operations.length },
    })
    throw error
  }
}

/**
 * Écrit tous les items d'un objet dans une sous-collection
 * Utilisé pour la migration initiale et l'import de données
 */
export async function writeAllToSubcollection(
  userId: string,
  collection: SubcollectionName,
  data: { [id: string]: any },
  onChunkProgress?: ChunkProgressCallback
): Promise<void> {
  if (!data || Object.keys(data).length === 0) {
    console.log(`[Subcollections] No data to write to ${collection}`)
    return
  }

  const changes: BatchChanges = {
    set: data,
    delete: [],
  }

  await batchWriteSubcollection(userId, collection, changes, onChunkProgress)
}

/**
 * Supprime tous les documents d'une sous-collection
 * Attention: opération coûteuse, à utiliser avec précaution
 */
export async function clearSubcollection(
  userId: string,
  collectionName: SubcollectionName,
  onChunkProgress?: ChunkProgressCallback
): Promise<void> {
  const collectionRef = getSubcollectionRef(userId, collectionName)

  try {
    const snapshot = await getDocs(collectionRef)

    if (snapshot.empty) {
      console.log(`[Subcollections] ${collectionName} is already empty`)
      // Call progress callback with 1/1 to indicate completion
      onChunkProgress?.(1, 1)
      return
    }

    const docIds = snapshot.docs.map((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.id)

    await batchWriteSubcollection(
      userId,
      collectionName,
      {
        set: {},
        delete: docIds,
      },
      onChunkProgress
    )

    console.log(`[Subcollections] Cleared ${collectionName}: ${docIds.length} docs deleted`)
  } catch (error) {
    console.error(`[Subcollections] Failed to clear ${collectionName}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'clear', collection: collectionName },
      extra: { userId },
    })
    throw error
  }
}

/**
 * Récupère tous les documents d'une sous-collection
 * Transforme en objet avec ID comme clé (format Redux)
 */
export async function fetchSubcollection(
  userId: string,
  collectionName: SubcollectionName
): Promise<{ [id: string]: any }> {
  try {
    const collectionRef = getSubcollectionRef(userId, collectionName)
    const snapshot = await getDocs(collectionRef)

    const result: { [id: string]: any } = {}
    snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      result[decodeDocumentId(docSnap.id)] = docSnap.data()
    })

    console.log(`[Subcollections] Fetched ${collectionName}: ${Object.keys(result).length} docs`)
    return result
  } catch (error) {
    console.error(`[Subcollections] Failed to fetch ${collectionName}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'fetch', collection: collectionName },
      extra: { userId },
    })
    throw error
  }
}

/**
 * Type pour le callback de changements
 */
export type SubcollectionChangeCallback = (
  data: { [id: string]: any },
  changes: {
    added: { [id: string]: any }
    modified: { [id: string]: any }
    removed: string[]
  }
) => void

/**
 * S'abonne aux changements d'une sous-collection
 * Retourne une fonction pour se désabonner
 */
export function subscribeToSubcollection(
  userId: string,
  collectionName: SubcollectionName,
  onChange: SubcollectionChangeCallback
): () => void {
  const collectionRef = getSubcollectionRef(userId, collectionName)
  let isFirstSnapshot = true

  const unsubscribe = onSnapshot(
    collectionRef,
    snapshot => {
      // Ignorer les changements locaux
      if (snapshot.metadata.hasPendingWrites) {
        return
      }

      // Construire l'objet complet (avec décodage des IDs)
      const data: { [id: string]: any } = {}
      snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
        data[decodeDocumentId(docSnap.id)] = docSnap.data()
      })

      // Pour le premier snapshot, on envoie tout comme "added"
      if (isFirstSnapshot) {
        isFirstSnapshot = false
        onChange(data, {
          added: data,
          modified: {},
          removed: [],
        })
        return
      }

      // Pour les snapshots suivants, on détecte les changements
      const added: { [id: string]: any } = {}
      const modified: { [id: string]: any } = {}
      const removed: string[] = []

      snapshot.docChanges().forEach((change: FirebaseFirestoreTypes.DocumentChange) => {
        const docData = change.doc.data()
        const docId = decodeDocumentId(change.doc.id)

        switch (change.type) {
          case 'added':
            added[docId] = docData
            break
          case 'modified':
            modified[docId] = docData
            break
          case 'removed':
            removed.push(docId)
            break
        }
      })

      onChange(data, { added, modified, removed })
    },
    error => {
      console.error(`[Subcollections] Subscription error for ${collectionName}:`, error)
      Sentry.captureException(error, {
        tags: { feature: 'subcollections', action: 'subscribe', collection: collectionName },
        extra: { userId },
      })
    }
  )

  return unsubscribe
}

/**
 * Vérifie si un document existe dans une sous-collection
 */
export async function existsInSubcollection(
  userId: string,
  collectionName: SubcollectionName,
  docId: string
): Promise<boolean> {
  try {
    const docRef = doc(getSubcollectionRef(userId, collectionName), encodeDocumentId(docId))
    const docSnap = await getDoc(docRef)
    return docSnap.exists()
  } catch (error) {
    console.error(`[Subcollections] Failed to check existence in ${collectionName}/${docId}:`, error)
    return false
  }
}
