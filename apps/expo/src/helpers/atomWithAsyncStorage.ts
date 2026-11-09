import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import { getDefaultStore } from 'jotai/vanilla'
import { storage } from './storage'

function getItem(key: string): string | null {
  const value = storage.getString(key)
  return value ? value : null
}

function setItem(key: string, value: string): void {
  storage.set(key, value)
}

function removeItem(key: string): void {
  storage.remove(key)
}

function clearAll(): void {
  storage.clearAll()
}

type OtherPagesSubscription = (key: string, callback: (value: string | null) => void) => () => void

// Only the browser's storage has it: there, several pages of the workspace share one storage.
const subscribeToOtherPages = (storage as { subscribe?: OtherPagesSubscription }).subscribe

interface AtomWithAsyncStorageOptions<T> {
  migrate?: (value: T) => T
  /** JSON replacer applied on write, to keep session-only values out of storage. */
  replacer?: (key: string, value: unknown) => unknown
  /**
   * Follows what the other browser pages of the workspace write (web only). Receives the value
   * another page wrote and the one this page holds, and returns what this page keeps. That
   * value is not written back, so two pages cannot answer each other without end.
   */
  mergeFromOtherPages?: (written: T, current: T) => T
}

const atomWithAsyncStorage = <T>(
  key: string,
  initialValue: T,
  options?: AtomWithAsyncStorageOptions<T>
) => {
  const mergeFromOtherPages = options?.mergeFromOtherPages
  const followsOtherPages = Boolean(mergeFromOtherPages && subscribeToOtherPages)
  const jsonStorage = createJSONStorage<T>(
    () => ({
      getItem: (k: string) => {
        const value = getItem(k)
        if (value && options?.migrate) {
          try {
            const parsed = JSON.parse(value) as T
            const migrated = options.migrate(parsed)
            // If migration changed the value, save it
            if (JSON.stringify(migrated) !== value) {
              setItem(k, JSON.stringify(migrated))
            }
            return JSON.stringify(migrated)
          } catch {
            return value
          }
        }
        return value
      },
      setItem,
      removeItem,
      clearAll,
      ...(followsOtherPages
        ? {
            subscribe: (k: string, callback: (value: string | null) => void) =>
              subscribeToOtherPages!(k, callback),
          }
        : {}),
    }),
    { replacer: options?.replacer }
  )

  const subscribe = jsonStorage.subscribe
  const followedStorage =
    followsOtherPages && subscribe
      ? {
          ...jsonStorage,
          subscribe: (k: string, callback: (value: T) => void, initial: T) =>
            subscribe(
              k,
              written => {
                const migrated = options?.migrate ? options.migrate(written) : written
                callback(mergeFromOtherPages!(migrated, getDefaultStore().get(storedAtom)))
              },
              initial
            ),
        }
      : jsonStorage

  const storedAtom = atomWithStorage<T>(key, initialValue, followedStorage, {
    getOnInit: true,
  })
  return storedAtom
}

export default atomWithAsyncStorage
