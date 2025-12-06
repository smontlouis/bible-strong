import * as Sentry from '@sentry/react-native'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import { storage } from './storage'

// Keys that are important to track for debugging
const TRACKED_KEYS = ['tabsAtom', 'activeTabIndexAtomOriginal', 'history']

function getItem(key: string): string | null {
  try {
    const value = storage.getString(key)

    // Handle undefined, null, and empty string cases
    if (value === undefined || value === null) {
      if (TRACKED_KEYS.includes(key)) {
        Sentry.addBreadcrumb({
          category: 'storage',
          message: `MMKV getItem returned null for "${key}"`,
          level: 'info',
        })
      }
      return null
    }

    if (TRACKED_KEYS.includes(key)) {
      Sentry.addBreadcrumb({
        category: 'storage',
        message: `MMKV getItem success for "${key}"`,
        level: 'info',
        data: { valueLength: value.length },
      })
    }

    // Empty string is a valid value (though unusual), don't treat as null
    return value
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'atomWithAsyncStorage.getItem',
        key,
      },
    })
    return null
  }
}

function setItem(key: string, value: string): void {
  try {
    storage.set(key, value)

    if (TRACKED_KEYS.includes(key)) {
      Sentry.addBreadcrumb({
        category: 'storage',
        message: `MMKV setItem for "${key}"`,
        level: 'info',
        data: { valueLength: value.length },
      })
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'atomWithAsyncStorage.setItem',
        key,
        valueLength: value?.length,
      },
    })
  }
}

function removeItem(key: string): void {
  try {
    storage.delete(key)

    if (TRACKED_KEYS.includes(key)) {
      Sentry.addBreadcrumb({
        category: 'storage',
        message: `MMKV removeItem for "${key}"`,
        level: 'warning',
      })
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'atomWithAsyncStorage.removeItem',
        key,
      },
    })
  }
}

function clearAll(): void {
  try {
    Sentry.addBreadcrumb({
      category: 'storage',
      message: 'MMKV clearAll called',
      level: 'warning',
    })
    storage.clearAll()
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'atomWithAsyncStorage.clearAll',
      },
    })
  }
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
