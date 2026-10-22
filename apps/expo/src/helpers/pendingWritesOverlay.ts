import type { FirestoreSyncOutboxEntry } from './firestoreSyncOutbox'

/** Documents that queued local writes will still set or delete on the server. */
export type PendingWriteTargets = { written: Set<string>; deleted: Set<string> }

const emptyTargets = (): PendingWriteTargets => ({ written: new Set(), deleted: new Set() })

export const getPendingSubcollectionTargets = (
  entries: FirestoreSyncOutboxEntry[],
  collection: string
): PendingWriteTargets => {
  const targets = emptyTargets()
  for (const { intent } of entries) {
    if (intent.kind !== 'subcollection' || intent.collection !== collection) continue
    Object.keys(intent.set).forEach(id => targets.written.add(id))
    intent.delete.forEach(id => targets.deleted.add(id))
  }
  return targets
}

export const getPendingStudyTargets = (
  entries: FirestoreSyncOutboxEntry[]
): PendingWriteTargets => {
  const targets = emptyTargets()
  for (const { intent } of entries) {
    if (intent.kind === 'subcollection' || intent.path[0] !== 'studies' || !intent.path[1]) {
      continue
    }
    if (intent.kind === 'document-delete') targets.deleted.add(intent.path[1])
    else targets.written.add(intent.path[1])
  }
  return targets
}

/**
 * What the server sends, with the local value of every document a queued write will still
 * change. Firestore does the same for the writes it holds; the queue's writes (refused, or made
 * while signed out) are not in Firestore yet, and a snapshot must not take them back.
 */
export const keepPendingWrites = <T>(
  remote: Record<string, T>,
  local: Record<string, T> | undefined,
  targets: PendingWriteTargets
): Record<string, T> => {
  const result = { ...remote }
  targets.written.forEach(id => {
    if (local?.[id] !== undefined) result[id] = local[id]
  })
  targets.deleted.forEach(id => {
    delete result[id]
  })
  return result
}

export const isPendingWriteTarget = (targets: PendingWriteTargets, id: string) =>
  targets.written.has(id) || targets.deleted.has(id)

export const withoutPendingWriteTargets = <T>(
  documents: Record<string, T>,
  targets: PendingWriteTargets
): Record<string, T> =>
  Object.fromEntries(Object.entries(documents).filter(([id]) => !isPendingWriteTarget(targets, id)))
