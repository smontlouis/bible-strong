import type { Storage } from 'redux-persist'

const STORAGE_PREFIX = 'bible-strong:'
const memoryStorage = new Map<string, string>()

const browserStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

const read = (key: string) => {
  const namespacedKey = `${STORAGE_PREFIX}${key}`
  return browserStorage()?.getItem(namespacedKey) ?? memoryStorage.get(namespacedKey) ?? undefined
}

const write = (key: string, value: string) => {
  const namespacedKey = `${STORAGE_PREFIX}${key}`
  try {
    browserStorage()?.setItem(namespacedKey, value)
  } catch {
    memoryStorage.set(namespacedKey, value)
  }
}

const remove = (key: string) => {
  const namespacedKey = `${STORAGE_PREFIX}${key}`
  try {
    browserStorage()?.removeItem(namespacedKey)
  } finally {
    memoryStorage.delete(namespacedKey)
  }
}

export const storage = {
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
  clearAll() {
    const target = browserStorage()
    if (target) {
      const keys = Array.from({ length: target.length }, (_, index) => target.key(index)).filter(
        (key): key is string => Boolean(key?.startsWith(STORAGE_PREFIX))
      )
      keys.forEach(key => target.removeItem(key))
    }
    memoryStorage.clear()
  },
}

export const mmkvStorage: Storage = {
  setItem: async (key, value) => {
    storage.set(key, value)
    return true
  },
  getItem: async key => storage.getString(key),
  removeItem: async key => storage.remove(key),
}

export const prepareLegacyStorageForLocalMigrations = async () => undefined
