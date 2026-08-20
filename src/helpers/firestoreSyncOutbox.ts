import { batchWriteSubcollection, type SubcollectionName } from './firestoreSubcollections'
import { deleteDoc, deleteField, doc, firebaseDb, setDoc } from './firebase'
import { storage as defaultStorage } from './storage'

const STORAGE_KEY = 'firestore_sync_outbox_v1'
const MAX_BACKOFF_MS = 5 * 60 * 1000

export type SerializableDocument = Record<string, unknown>
const DELETE_FIELD_MARKER = '__bibleStrongFirestoreDeleteField__'

export type FirestoreSyncIntent =
  | {
      kind: 'subcollection'
      collection: SubcollectionName
      set: Record<string, SerializableDocument>
      delete: string[]
    }
  | {
      kind: 'document-set'
      path: string[]
      data: SerializableDocument
      merge: boolean
    }
  | {
      kind: 'document-delete'
      path: string[]
    }

export type FirestoreSyncOutboxEntry = {
  id: string
  userId: string
  intent: FirestoreSyncIntent
  createdAt: number
  attempts: number
  nextAttemptAt: number
  generation: number
}

export interface FirestoreSyncOutboxStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): unknown
  remove(key: string): unknown
}

type FirestoreSyncOutboxDependencies = {
  storage: FirestoreSyncOutboxStorage
  execute(entry: FirestoreSyncOutboxEntry): Promise<void>
  now(): number
  schedule?(callback: () => void, delayMs: number): unknown
  cancelScheduled?(handle: unknown): void
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isDeleteFieldValue = (value: unknown): boolean => {
  if (!isPlainObject(value) || value._type !== 'delete' || typeof value.isEqual !== 'function') {
    return false
  }
  try {
    return Boolean(
      (value.isEqual as (this: unknown, other: unknown) => boolean).call(value, deleteField())
    )
  } catch {
    return false
  }
}

const isEncodedDeleteField = (value: unknown): boolean =>
  isPlainObject(value) && value[DELETE_FIELD_MARKER] === true

export const encodeFirestoreSyncData = (value: unknown): unknown => {
  if (isDeleteFieldValue(value)) {
    return { [DELETE_FIELD_MARKER]: true }
  }
  if (Array.isArray(value)) return value.map(encodeFirestoreSyncData)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, encodeFirestoreSyncData(child)])
  )
}

export const decodeFirestoreSyncData = (
  value: unknown,
  createDeleteField: () => unknown = deleteField
): unknown => {
  if (isEncodedDeleteField(value)) return createDeleteField()
  if (Array.isArray(value)) {
    return value.map(child => decodeFirestoreSyncData(child, createDeleteField))
  }
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      decodeFirestoreSyncData(child, createDeleteField),
    ])
  )
}

const targetKey = (intent: FirestoreSyncIntent): string => {
  if (intent.kind === 'subcollection') return `subcollection:${intent.collection}`
  return `document:${intent.path.join('/')}`
}

const entryId = (userId: string, intent: FirestoreSyncIntent): string =>
  `${userId}:${targetKey(intent)}`

const mergeSubcollectionIntents = (
  previous: Extract<FirestoreSyncIntent, { kind: 'subcollection' }>,
  next: Extract<FirestoreSyncIntent, { kind: 'subcollection' }>
): Extract<FirestoreSyncIntent, { kind: 'subcollection' }> => {
  const set = { ...previous.set, ...next.set }
  const deleted = new Set(previous.delete)

  for (const id of Object.keys(next.set)) deleted.delete(id)
  for (const id of next.delete) {
    delete set[id]
    deleted.add(id)
  }

  return { ...next, set, delete: [...deleted] }
}

const mergeDocuments = (
  previous: SerializableDocument,
  next: SerializableDocument
): SerializableDocument => {
  const merged = { ...previous }
  for (const [key, value] of Object.entries(next)) {
    const previousValue = merged[key]
    merged[key] =
      !isEncodedDeleteField(previousValue) &&
      !isEncodedDeleteField(value) &&
      previousValue &&
      value &&
      typeof previousValue === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(previousValue) &&
      !Array.isArray(value)
        ? mergeDocuments(previousValue as SerializableDocument, value as SerializableDocument)
        : value
  }
  return merged
}

const parseEntries = (value: string | undefined): FirestoreSyncOutboxEntry[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? (parsed as FirestoreSyncOutboxEntry[]).map(entry => ({
          ...entry,
          generation: entry.generation ?? 1,
        }))
      : []
  } catch {
    return []
  }
}

export const createFirestoreSyncOutbox = ({
  storage,
  execute,
  now,
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancelScheduled = handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: FirestoreSyncOutboxDependencies) => {
  const replayPromises = new Map<string, Promise<void>>()
  const scheduledReplays = new Map<string, unknown>()
  const activeUsers = new Set<string>()

  const read = () => parseEntries(storage.getString(STORAGE_KEY))
  const write = (entries: FirestoreSyncOutboxEntry[]) => {
    if (entries.length === 0) {
      storage.remove(STORAGE_KEY)
      return
    }
    storage.set(STORAGE_KEY, JSON.stringify(entries))
  }

  const getPending = (userId: string) => read().filter(entry => entry.userId === userId)

  const cancelReplay = (userId: string) => {
    activeUsers.delete(userId)
    const handle = scheduledReplays.get(userId)
    if (handle !== undefined) cancelScheduled(handle)
    scheduledReplays.delete(userId)
  }

  const resumeReplay = (userId: string) => {
    activeUsers.add(userId)
    scheduleNextReplay(userId)
  }

  const scheduleNextReplay = (userId: string) => {
    cancelReplay(userId)
    activeUsers.add(userId)
    const nextAttemptAt = Math.min(...getPending(userId).map(entry => entry.nextAttemptAt))
    if (!Number.isFinite(nextAttemptAt)) return
    const handle = schedule(
      () => {
        scheduledReplays.delete(userId)
        if (!activeUsers.has(userId)) return
        void replay(userId)
      },
      Math.max(0, nextAttemptAt - now())
    )
    scheduledReplays.set(userId, handle)
  }

  const enqueue = (userId: string, intent: FirestoreSyncIntent) => {
    const entries = read()
    const encodedIntent = encodeFirestoreSyncData(intent) as FirestoreSyncIntent
    const id = entryId(userId, encodedIntent)
    const existingIndex = entries.findIndex(entry => entry.id === id)
    const existing = existingIndex === -1 ? undefined : entries[existingIndex]
    const compactedIntent =
      existing?.intent.kind === 'subcollection' && encodedIntent.kind === 'subcollection'
        ? mergeSubcollectionIntents(existing.intent, encodedIntent)
        : existing?.intent.kind === 'document-set' &&
            encodedIntent.kind === 'document-set' &&
            existing.intent.merge &&
            encodedIntent.merge
          ? {
              ...encodedIntent,
              data: mergeDocuments(existing.intent.data, encodedIntent.data),
            }
          : encodedIntent
    const entry: FirestoreSyncOutboxEntry = {
      id,
      userId,
      intent: compactedIntent,
      createdAt: existing?.createdAt ?? now(),
      attempts: 0,
      nextAttemptAt: now(),
      generation: (existing?.generation ?? 0) + 1,
    }

    if (existingIndex === -1) entries.push(entry)
    else entries[existingIndex] = entry
    write(entries)
    if (activeUsers.has(userId)) scheduleNextReplay(userId)
  }

  const supersedePending = (userId: string, intent: FirestoreSyncIntent) => {
    const id = entryId(userId, intent)
    if (!read().some(entry => entry.id === id)) return
    enqueue(userId, intent)
  }

  const replay = async (userId: string): Promise<void> => {
    const existingReplay = replayPromises.get(userId)
    if (existingReplay) return existingReplay

    const replayPromise = (async () => {
      const dueEntries = getPending(userId).filter(entry => entry.nextAttemptAt <= now())
      for (const entry of dueEntries) {
        try {
          await execute(entry)
          write(
            read().filter(
              candidate => candidate.id !== entry.id || candidate.generation !== entry.generation
            )
          )
        } catch {
          const entries = read()
          const index = entries.findIndex(
            candidate => candidate.id === entry.id && candidate.generation === entry.generation
          )
          if (index === -1) continue
          const attempts = entries[index].attempts + 1
          entries[index] = {
            ...entries[index],
            attempts,
            nextAttemptAt: now() + Math.min(1000 * 2 ** (attempts - 1), MAX_BACKOFF_MS),
          }
          write(entries)
        }
      }
      if (activeUsers.has(userId)) scheduleNextReplay(userId)
    })().finally(() => {
      replayPromises.delete(userId)
    })

    replayPromises.set(userId, replayPromise)
    return replayPromise
  }

  return { cancelReplay, enqueue, getPending, replay, resumeReplay, supersedePending }
}

const firestoreSyncTargetTails = new Map<string, Promise<void>>()

export const runFirestoreSyncIntentsSerialized = async <T>(
  userId: string,
  intents: FirestoreSyncIntent[],
  operation: () => Promise<T>
): Promise<T> => {
  const keys = [...new Set(intents.map(intent => `${userId}:${targetKey(intent)}`))].sort()

  const runAt = async (index: number): Promise<T> => {
    const key = keys[index]
    if (!key) return operation()

    const previous = firestoreSyncTargetTails.get(key) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => {
      release = resolve
    })
    const tail = previous.catch(() => undefined).then(() => current)
    firestoreSyncTargetTails.set(key, tail)

    await previous.catch(() => undefined)
    try {
      return await runAt(index + 1)
    } finally {
      release()
      if (firestoreSyncTargetTails.get(key) === tail) firestoreSyncTargetTails.delete(key)
    }
  }

  return runAt(0)
}

const executeFirestoreSyncOutboxEntry = async ({
  userId,
  intent,
}: FirestoreSyncOutboxEntry): Promise<void> => {
  if (intent.kind === 'subcollection') {
    await batchWriteSubcollection(userId, intent.collection, {
      set: intent.set,
      delete: intent.delete,
      merge: false,
    })
    return
  }

  const reference = doc(firebaseDb, ...intent.path)
  if (intent.kind === 'document-delete') {
    await deleteDoc(reference)
    return
  }

  await setDoc(reference, decodeFirestoreSyncData(intent.data) as SerializableDocument, {
    merge: intent.merge,
  })
}

export const firestoreSyncOutbox = createFirestoreSyncOutbox({
  storage: defaultStorage,
  execute: entry =>
    runFirestoreSyncIntentsSerialized(entry.userId, [entry.intent], async () => {
      const isStillCurrent = firestoreSyncOutbox
        .getPending(entry.userId)
        .some(candidate => candidate.id === entry.id && candidate.generation === entry.generation)
      if (!isStillCurrent) return
      await executeFirestoreSyncOutboxEntry(entry)
    }),
  now: Date.now,
})
