import * as Sentry from '@sentry/react-native'
import { firebaseDb } from './firebase'

/**
 * Types pour les sous-collections
 */
export type SubcollectionName =
  | 'highlights'
  | 'notes'
  | 'tags'
  | 'strongsHebreu'
  | 'strongsGrec'
  | 'words'
  | 'naves'

export const SUBCOLLECTION_NAMES: SubcollectionName[] = [
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
 * Valide si un ID est valide pour Firestore
 * Document IDs cannot be empty, contain '/', or be '.' or '..'
 */
function isValidDocumentId(docId: string): boolean {
  if (!docId || docId.length === 0) return false
  if (docId === '.' || docId === '..') return false
  if (docId.includes('/')) return false
  // Check for reasonable length (Firestore limit is 1500 bytes)
  if (docId.length > 1500) return false
  return true
}

/**
 * Obtient une référence à une sous-collection
 */
export function getSubcollectionRef(
  userId: string,
  collection: SubcollectionName
) {
  return firebaseDb.collection('users').doc(userId).collection(collection)
}

/**
 * Écrit un document dans une sous-collection
 */
export async function writeToSubcollection(
  userId: string,
  collection: SubcollectionName,
  docId: string,
  data: any
): Promise<void> {
  try {
    const ref = getSubcollectionRef(userId, collection).doc(docId)
    await ref.set(data, { merge: true })
  } catch (error) {
    console.error(
      `[Subcollections] Failed to write to ${collection}/${docId}:`,
      error
    )
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'write', collection },
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
  collection: SubcollectionName,
  docId: string
): Promise<void> {
  try {
    const ref = getSubcollectionRef(userId, collection).doc(docId)
    await ref.delete()
  } catch (error) {
    console.error(
      `[Subcollections] Failed to delete from ${collection}/${docId}:`,
      error
    )
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'delete', collection },
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
export type ChunkProgressCallback = (
  chunkIndex: number,
  totalChunks: number
) => void

/**
 * Écrit plusieurs documents en batch avec chunking automatique
 * Gère les batchs de plus de 500 opérations
 */
export async function batchWriteSubcollection(
  userId: string,
  collection: SubcollectionName,
  changes: BatchChanges,
  onChunkProgress?: ChunkProgressCallback
): Promise<void> {
  const collectionRef = getSubcollectionRef(userId, collection)

  // Préparer toutes les opérations
  const operations: Array<{ type: 'set' | 'delete'; docId: string; data?: any }> = []
  const skippedIds: string[] = []

  // Ajouter les opérations set (avec validation des IDs)
  for (const [docId, data] of Object.entries(changes.set)) {
    if (isValidDocumentId(docId)) {
      operations.push({ type: 'set', docId, data })
    } else {
      skippedIds.push(docId || '(empty)')
    }
  }

  // Ajouter les opérations delete (avec validation des IDs)
  for (const docId of changes.delete) {
    if (isValidDocumentId(docId)) {
      operations.push({ type: 'delete', docId })
    } else {
      skippedIds.push(docId || '(empty)')
    }
  }

  // Log skipped IDs if any
  if (skippedIds.length > 0) {
    console.warn(
      `[Subcollections] Skipped ${skippedIds.length} invalid document ID(s) in ${collection}:`,
      skippedIds.slice(0, 5).join(', '),
      skippedIds.length > 5 ? `... and ${skippedIds.length - 5} more` : ''
    )
  }

  if (operations.length === 0) {
    return
  }

  // Découper en chunks
  const chunks: typeof operations[] = []
  for (let i = 0; i < operations.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(operations.slice(i, i + BATCH_CHUNK_SIZE))
  }

  console.log(
    `[Subcollections] Batch write to ${collection}: ${operations.length} ops in ${chunks.length} chunk(s)`
  )

  try {
    // Exécuter chaque chunk séquentiellement
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const batch = firebaseDb.batch()

      for (const op of chunk) {
        const docRef = collectionRef.doc(op.docId)
        if (op.type === 'set') {
          batch.set(docRef, op.data, { merge: true })
        } else {
          batch.delete(docRef)
        }
      }

      await batch.commit()
      console.log(
        `[Subcollections] Chunk ${i + 1}/${chunks.length} committed (${chunk.length} ops)`
      )

      // Report chunk progress
      onChunkProgress?.(i + 1, chunks.length)
    }
  } catch (error) {
    console.error(`[Subcollections] Batch write failed for ${collection}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'batch_write', collection },
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
  collection: SubcollectionName
): Promise<void> {
  const collectionRef = getSubcollectionRef(userId, collection)

  try {
    const snapshot = await collectionRef.get()

    if (snapshot.empty) {
      console.log(`[Subcollections] ${collection} is already empty`)
      return
    }

    const docIds = snapshot.docs.map((doc) => doc.id)

    await batchWriteSubcollection(userId, collection, {
      set: {},
      delete: docIds,
    })

    console.log(`[Subcollections] Cleared ${collection}: ${docIds.length} docs deleted`)
  } catch (error) {
    console.error(`[Subcollections] Failed to clear ${collection}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'clear', collection },
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
  collection: SubcollectionName
): Promise<{ [id: string]: any }> {
  try {
    const collectionRef = getSubcollectionRef(userId, collection)
    const snapshot = await collectionRef.get()

    const result: { [id: string]: any } = {}
    snapshot.forEach((doc) => {
      result[doc.id] = doc.data()
    })

    console.log(`[Subcollections] Fetched ${collection}: ${Object.keys(result).length} docs`)
    return result
  } catch (error) {
    console.error(`[Subcollections] Failed to fetch ${collection}:`, error)
    Sentry.captureException(error, {
      tags: { feature: 'subcollections', action: 'fetch', collection },
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
  collection: SubcollectionName,
  onChange: SubcollectionChangeCallback
): () => void {
  const collectionRef = getSubcollectionRef(userId, collection)
  let isFirstSnapshot = true

  const unsubscribe = collectionRef.onSnapshot(
    (snapshot) => {
      // Ignorer les changements locaux
      if (snapshot.metadata.hasPendingWrites) {
        return
      }

      // Construire l'objet complet
      const data: { [id: string]: any } = {}
      snapshot.forEach((doc) => {
        data[doc.id] = doc.data()
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

      snapshot.docChanges().forEach((change) => {
        const docData = change.doc.data()
        const docId = change.doc.id

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
    (error) => {
      console.error(`[Subcollections] Subscription error for ${collection}:`, error)
      Sentry.captureException(error, {
        tags: { feature: 'subcollections', action: 'subscribe', collection },
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
  collection: SubcollectionName,
  docId: string
): Promise<boolean> {
  try {
    const ref = getSubcollectionRef(userId, collection).doc(docId)
    const doc = await ref.get()
    return doc.exists
  } catch (error) {
    console.error(
      `[Subcollections] Failed to check existence in ${collection}/${docId}:`,
      error
    )
    return false
  }
}
