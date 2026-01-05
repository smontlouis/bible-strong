import { atomWithStorage, createJSONStorage } from 'jotai/utils'
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

interface AtomWithAsyncStorageOptions<T> {
  migrate?: (value: T) => T
}

const atomWithAsyncStorage = <T>(
  key: string,
  initialValue: T,
  options?: AtomWithAsyncStorageOptions<T>
) =>
  atomWithStorage<T>(
    key,
    initialValue,
    createJSONStorage<T>(() => ({
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
    })),
    {
      getOnInit: true,
    }
  )

export default atomWithAsyncStorage
