import type { Storage } from 'redux-persist'

import { appLogger } from '~helpers/agentObservability'

export interface KeyedPersistBackend {
  getString(key: string): string | undefined
  set(key: string, value: string): unknown
  remove(key: string): unknown
}

type PersistedObject = Record<string, unknown>

type StoredSlice = {
  /** The keys listed by the index, as last read or written. */
  keys?: string[]
  /** The value last read or written for each key. */
  values: Map<string, unknown>
  /** A value in the former single-key format is still to be removed. */
  legacyPending: boolean
}

const INDEX_SUFFIX = 'keys'

export const keyedValueKey = (storageKey: string, key: string) => `${storageKey}:${key}`
export const keyedIndexKey = (storageKey: string) => `${storageKey}:${INDEX_SUFFIX}`

const sameKeys = (a: string[], b: string[]) =>
  a.length === b.length && a.every(key => b.includes(key))

/**
 * Storage for a redux-persist config with `serialize: false` and `deserialize: false`: each
 * top-level key of the persisted state has its own storage key (`plan:myPlans`,
 * `plan:ongoingPlans`…), listed by an index (`plan:keys`). redux-persist hands over the whole
 * object at each write; only the keys whose value changed since the last write are serialized and
 * written. Redux state is immutable, so a new reference is a change. The former format, a JSON
 * object of JSON strings under the storage key itself, is moved to the new keys on the first read.
 */
export const createKeyedPersistStorage = (backend: KeyedPersistBackend): Storage => {
  const slices = new Map<string, StoredSlice>()

  const readIndex = (storageKey: string): string[] | undefined => {
    const serialized = backend.getString(keyedIndexKey(storageKey))
    if (serialized === undefined) return undefined
    try {
      const keys = JSON.parse(serialized) as unknown
      if (Array.isArray(keys) && keys.every(key => typeof key === 'string')) return keys
      throw new Error('The index is not a list of keys')
    } catch (error) {
      appLogger.captureError('redux', 'persist.keyed_index_unreadable', error, { storageKey })
      return undefined
    }
  }

  // Runs synchronously: redux-persist keeps changing the object it passed once the call returns.
  const write = (storageKey: string, state: PersistedObject) => {
    let slice = slices.get(storageKey)
    if (!slice) {
      slice = { values: new Map(), legacyPending: false }
      slices.set(storageKey, slice)
    }
    const keys = Object.keys(state).filter(key => state[key] !== undefined)
    if (keys.includes(INDEX_SUFFIX)) {
      throw new Error(`"${INDEX_SUFFIX}" is reserved for the index of ${storageKey}`)
    }

    let failure: unknown
    for (const key of keys) {
      const value = state[key]
      if (slice.values.has(key) && slice.values.get(key) === value) continue
      try {
        backend.set(keyedValueKey(storageKey, key), JSON.stringify(value))
        slice.values.set(key, value)
      } catch (error) {
        // The other keys are still written: the progress is kept when the plans content cannot be.
        failure ??= error
      }
    }
    // A key enters the index only once its value is stored. A failed key is written again at the
    // next write, its last stored value staying readable meanwhile.
    if (failure !== undefined) throw failure

    const storedKeys = slice.keys ?? readIndex(storageKey) ?? []
    if (!sameKeys(storedKeys, keys)) {
      backend.set(keyedIndexKey(storageKey), JSON.stringify(keys))
    }
    slice.keys = keys
    const droppedKeys = new Set([...storedKeys, ...slice.values.keys()])
    keys.forEach(key => droppedKeys.delete(key))
    droppedKeys.forEach(key => {
      backend.remove(keyedValueKey(storageKey, key))
      slice.values.delete(key)
    })

    if (slice.legacyPending) {
      backend.remove(storageKey)
      slice.legacyPending = false
    }
  }

  return {
    getItem: async (storageKey: string): Promise<PersistedObject | undefined> => {
      const keys = readIndex(storageKey)
      const slice: StoredSlice = { keys: keys ?? [], values: new Map(), legacyPending: false }
      slices.set(storageKey, slice)

      if (keys) {
        const state: PersistedObject = {}
        for (const key of keys) {
          const serialized = backend.getString(keyedValueKey(storageKey, key))
          if (serialized === undefined) continue
          try {
            state[key] = JSON.parse(serialized)
            slice.values.set(key, state[key])
          } catch (error) {
            // Only this key starts again from the reducer's state; it is written at the next write.
            appLogger.captureError('redux', 'persist.keyed_value_unreadable', error, {
              storageKey,
              key,
            })
          }
        }
        // The index is written once the new keys are: a value left in the former format is either
        // a removal cut short or one an older version wrote after an update was rolled back. The
        // new keys stay authoritative.
        backend.remove(storageKey)
        return state
      }

      const legacy = backend.getString(storageKey)
      if (legacy === undefined) return undefined
      // Even an unreadable former value is removed once the state is written in the new format,
      // as redux-persist overwrote it before.
      slice.legacyPending = true
      const serializedState = JSON.parse(legacy) as Record<string, string>
      const state: PersistedObject = Object.fromEntries(
        Object.entries(serializedState).map(([key, value]) => [key, JSON.parse(value)])
      )
      try {
        write(storageKey, state)
      } catch (error) {
        // The state is restored all the same; the former value is kept until a write succeeds.
        appLogger.captureError('redux', 'persist.keyed_migration_failed', error, { storageKey })
      }
      return state
    },
    setItem: async (storageKey: string, state: PersistedObject) => write(storageKey, state),
    removeItem: async (storageKey: string) => {
      const slice = slices.get(storageKey)
      slices.delete(storageKey)
      const keys = new Set([
        ...(slice?.keys ?? readIndex(storageKey) ?? []),
        ...(slice ? Array.from(slice.values.keys()) : []),
      ])
      // The index goes last: a removal cut short leaves listed keys without values, read as absent.
      backend.remove(storageKey)
      keys.forEach(key => backend.remove(keyedValueKey(storageKey, key)))
      backend.remove(keyedIndexKey(storageKey))
    },
  }
}
