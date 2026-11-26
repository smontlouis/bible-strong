import type { Storage } from 'redux-persist'

/**
 * The browser's key-value store, MMKV's counterpart.
 *
 * Reads are synchronous, as the mobile code expects, from a copy in memory that `prepareStorage`
 * loads from IndexedDB before any module of the app runs (`index.web.ts`). Writes reach IndexedDB
 * in the order they were made; the other pages of the workspace hear of them on a
 * BroadcastChannel. IndexedDB holds hundreds of MB, where localStorage stops at 5 to 10 MB per
 * origin: a full account and the meditation books it reads went past that, and every write after
 * was lost.
 *
 * The first start moves the values localStorage held into IndexedDB, then removes them. Where
 * IndexedDB cannot be opened, the store stays in localStorage, as before. A later start where
 * IndexedDB does not answer begins from that emptied localStorage, and what it writes there is
 * dropped once IndexedDB answers again: a signed-in reader gets it back from the sync.
 */

export type StorageOp =
  | { op: 'set'; key: string; value: string }
  | { op: 'remove'; key: string }
  | { op: 'clear' }

/** The durable side of the store: IndexedDB in the browser, a fake in the tests. */
export interface DurableStore {
  load(): Promise<Map<string, string>>
  apply(ops: StorageOp[]): Promise<void>
}

type Channel = {
  postMessage(message: StorageOp): void
  addEventListener(type: 'message', listener: (event: MessageEvent<StorageOp>) => void): void
}

export interface WebStorageEnvironment {
  openDurable: () => Promise<DurableStore | undefined>
  localStorage: () => globalThis.Storage | undefined
  channel: () => Channel | undefined
  onError: (event: string, error: unknown) => void
  /** How long to wait for IndexedDB before keeping localStorage: an open can hang. */
  openTimeoutMs: number
}

const STORAGE_PREFIX = 'bible-strong:'
const DATABASE_NAME = 'bible-strong-storage'
const STORE_NAME = 'values'
const CHANNEL_NAME = 'bible-strong:storage'

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  new Promise(resolve => {
    const timer = setTimeout(() => resolve(undefined), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(undefined)
      }
    )
  })

export const createWebStorage = (environment: WebStorageEnvironment) => {
  // Until IndexedDB is ready, and for good where it is missing: localStorage, then memory.
  const memoryStorage = new Map<string, string>()
  let durable: DurableStore | undefined
  const values = new Map<string, string>()
  let queued: StorageOp[] = []
  let inFlight: Promise<void> | undefined
  let channel: Channel | undefined
  const listeners = new Map<string, Set<(value: string | null) => void>>()

  const local = () => {
    try {
      return environment.localStorage()
    } catch {
      return undefined
    }
  }

  const send = (): Promise<void> => {
    const store = durable
    const ops = queued
    queued = []
    if (!store || !ops.length) return Promise.resolve()
    let failed = false
    inFlight = store
      .apply(ops)
      .catch(error => {
        // Keep the writes for the next one rather than lose them, without retrying at once.
        failed = true
        queued = [...ops, ...queued]
        environment.onError('web.storage.write_failed', error)
      })
      .finally(() => {
        inFlight = undefined
        // What was written meanwhile.
        if (!failed && queued.length) void send()
      })
    return inFlight
  }

  const enqueue = (op: StorageOp) => {
    queued.push(op)
    try {
      channel?.postMessage(op)
    } catch {
      // Another page reads the value again at its next start.
    }
    if (!inFlight) queueMicrotask(() => !inFlight && queued.length && void send())
  }

  const notify = (key: string, value: string | null) =>
    listeners.get(key)?.forEach(listener => listener(value))

  // What another page of the workspace wrote: it reaches IndexedDB from that page.
  const receive = (op: StorageOp) => {
    if (op.op === 'set') {
      values.set(op.key, op.value)
      notify(op.key, op.value)
    } else if (op.op === 'remove') {
      values.delete(op.key)
      notify(op.key, null)
    } else {
      values.clear()
      listeners.forEach((_, key) => notify(key, null))
    }
  }

  const legacyKeys = (target: globalThis.Storage) =>
    Array.from({ length: target.length }, (_, index) => target.key(index)).filter(
      (key): key is string => Boolean(key?.startsWith(STORAGE_PREFIX))
    )

  const read = (key: string): string | undefined => {
    if (durable) return values.get(key)
    const namespacedKey = `${STORAGE_PREFIX}${key}`
    return local()?.getItem(namespacedKey) ?? memoryStorage.get(namespacedKey) ?? undefined
  }

  const write = (key: string, value: string) => {
    if (durable) {
      values.set(key, value)
      enqueue({ op: 'set', key, value })
      return
    }
    const namespacedKey = `${STORAGE_PREFIX}${key}`
    try {
      const target = local()
      if (target) target.setItem(namespacedKey, value)
      else memoryStorage.set(namespacedKey, value)
    } catch {
      memoryStorage.set(namespacedKey, value)
    }
  }

  const remove = (key: string) => {
    if (durable) {
      values.delete(key)
      enqueue({ op: 'remove', key })
      return
    }
    const namespacedKey = `${STORAGE_PREFIX}${key}`
    try {
      local()?.removeItem(namespacedKey)
    } finally {
      memoryStorage.delete(namespacedKey)
    }
  }

  let preparing: Promise<void> | undefined
  /** Loads IndexedDB into memory and moves localStorage's values there. Never rejects. */
  const prepareStorage = () =>
    (preparing ??= (async () => {
      const store = await withTimeout(environment.openDurable(), environment.openTimeoutMs)
      if (!store) return
      try {
        const stored = await store.load()
        const target = local()
        const keys = target ? legacyKeys(target) : []
        const moved: StorageOp[] = []
        for (const namespacedKey of keys) {
          const key = namespacedKey.slice(STORAGE_PREFIX.length)
          // IndexedDB wins where it has the key: what localStorage still holds was written by a
          // page of the former build, after another page had moved it.
          if (stored.has(key)) continue
          const value = target?.getItem(namespacedKey)
          if (value === null || value === undefined) continue
          stored.set(key, value)
          moved.push({ op: 'set', key, value })
        }
        if (moved.length) await store.apply(moved)
        // Removed only once IndexedDB holds them.
        keys.forEach(key => target?.removeItem(key))
        stored.forEach((value, key) => values.set(key, value))
        memoryStorage.forEach((value, namespacedKey) => {
          const key = namespacedKey.slice(STORAGE_PREFIX.length)
          if (!values.has(key)) {
            values.set(key, value)
            queued.push({ op: 'set', key, value })
          }
        })
        memoryStorage.clear()
        durable = store
        channel = environment.channel()
        channel?.addEventListener('message', event => receive(event.data))
        if (queued.length) void send()
      } catch (error) {
        environment.onError('web.storage.migration_failed', error)
      }
    })())

  /** Resolves once every write made so far has reached IndexedDB, or failed to. */
  const flushStorage = async (): Promise<void> => {
    if (!inFlight && queued.length) void send()
    while (inFlight) await inFlight
  }

  const storage = {
    set(key: string, value: string | number | boolean) {
      write(key, String(value))
    },
    getString: (key: string) => read(key),
    getBoolean(key: string) {
      const value = read(key)
      return value === undefined ? undefined : value === 'true'
    },
    getNumber(key: string) {
      const value = read(key)
      if (value === undefined) return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    },
    remove,
    /**
     * Calls back when another browser tab of the workspace writes `key`. Each tab runs its own
     * copy of the application over the same store; a tab is told of the other tabs' writes,
     * never of its own.
     */
    subscribe(key: string, callback: (value: string | null) => void): () => void {
      let keyListeners = listeners.get(key)
      if (!keyListeners) {
        keyListeners = new Set()
        listeners.set(key, keyListeners)
      }
      keyListeners.add(callback)
      // Without IndexedDB, the tabs share localStorage, whose writes the browser announces.
      const namespacedKey = `${STORAGE_PREFIX}${key}`
      const onStorage = (event: StorageEvent) => {
        if (!durable && event.key === namespacedKey && event.storageArea === local()) {
          callback(event.newValue)
        }
      }
      if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
      return () => {
        keyListeners.delete(callback)
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
      }
    },
    clearAll() {
      if (durable) {
        values.clear()
        enqueue({ op: 'clear' })
      }
      const target = local()
      if (target) legacyKeys(target).forEach(key => target.removeItem(key))
      memoryStorage.clear()
    },
  }

  const mmkvStorage: Storage = {
    setItem: async (key, value) => {
      storage.set(key, value)
      return true
    },
    getItem: async key => storage.getString(key),
    removeItem: async key => storage.remove(key),
  }

  return { storage, mmkvStorage, prepareStorage, flushStorage }
}

const request = <T>(operation: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () => reject(operation.error)
  })

const indexedDbStore = (database: IDBDatabase): DurableStore => ({
  load: () =>
    new Promise((resolve, reject) => {
      const values = new Map<string, string>()
      const cursor = database
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .openCursor()
      cursor.onsuccess = () => {
        const current = cursor.result
        if (!current) {
          resolve(values)
          return
        }
        if (typeof current.key === 'string' && typeof current.value === 'string') {
          values.set(current.key, current.value)
        }
        current.continue()
      }
      cursor.onerror = () => reject(cursor.error)
    }),
  apply: ops =>
    new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      for (const op of ops) {
        if (op.op === 'set') store.put(op.value, op.key)
        else if (op.op === 'remove') store.delete(op.key)
        else store.clear()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    }),
})

const openIndexedDb = async (): Promise<DurableStore | undefined> => {
  if (typeof indexedDB === 'undefined') return undefined
  const opening = indexedDB.open(DATABASE_NAME, 1)
  opening.onupgradeneeded = () => {
    opening.result.createObjectStore(STORE_NAME)
  }
  const database = await request(opening)
  // A later version opened by a newer build in another tab: let it upgrade.
  database.onversionchange = () => database.close()
  return indexedDbStore(database)
}

const webStorage = createWebStorage({
  openDurable: openIndexedDb,
  localStorage: () => globalThis.localStorage,
  channel: () =>
    typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(CHANNEL_NAME),
  onError: (event, error) => {
    // Required here only: the store loads before the rest of the app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { appLogger } = require('./agentObservability') as typeof import('./agentObservability')
    appLogger.captureError('startup', event, error)
  },
  openTimeoutMs: 3000,
})

export const { storage, mmkvStorage, prepareStorage, flushStorage } = webStorage

if (typeof window !== 'undefined') {
  // A closing page still sends what it holds.
  window.addEventListener('pagehide', () => void flushStorage())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushStorage()
  })
}

export const prepareLegacyStorageForLocalMigrations = async () => undefined
