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
  storage.delete(key)
}

function clearAll(): void {
  storage.clearAll()
}

const atomWithAsyncStorage = <T>(key: string, initialValue: T) =>
  atomWithStorage<T>(
    key,
    initialValue,
    createJSONStorage<T>(() => ({
      getItem,
      setItem,
      removeItem,
      clearAll,
    })),
    {
      getOnInit: true,
    }
  )

export default atomWithAsyncStorage
