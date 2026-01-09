import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { useEffect, useState } from 'react'
import { InteractionManager } from 'react-native'
import { createMMKV } from 'react-native-mmkv'
import { Storage } from 'redux-persist'
const deepmerge = require('@fastify/deepmerge')()

export const storage = createMMKV()

// TODO: Remove `hasMigratedFromAsyncStorage` after a while (when everyone has migrated)
export const hasMigratedFromAsyncStorage = storage.getBoolean('hasMigratedFromAsyncStorage')

// Flag to track if data has been migrated from FileSystem
export const hasMigratedFromFileSystem = storage.getBoolean('hasMigratedFromFileSystem')

// Flag to track if databases have been migrated to language folders
export const hasMigratedToLanguageFolders = storage.getBoolean('hasMigratedToLanguageFolders')

// TODO: Remove `hasMigratedFromAsyncStorage` after a while (when everyone has migrated)
export async function migrateFromAsyncStorage(): Promise<void> {
  console.log('[Storage] Migrating from AsyncStorage -> MMKV...')
  const start = global.performance.now()

  const keys = await AsyncStorage.getAllKeys()

  for (const key of keys) {
    try {
      const value = await AsyncStorage.getItem(key)

      if (value != null) {
        if (['true', 'false'].includes(value)) {
          storage.set(key, value === 'true')
        } else {
          storage.set(key, value)
        }

        AsyncStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Failed to migrate key "${key}" from AsyncStorage to MMKV!`, error)
      throw error
    }
  }

  storage.set('hasMigratedFromAsyncStorage', true)

  const end = global.performance.now()
  console.log(`[Storage] Migrated from AsyncStorage -> MMKV in ${end - start}ms!`)
}

export const useMigrateFromAsyncStorage = () => {
  const [hasMigrated, setHasMigrated] = useState(hasMigratedFromAsyncStorage)

  useEffect(() => {
    if (!hasMigratedFromAsyncStorage) {
      InteractionManager.runAfterInteractions(async () => {
        try {
          await migrateFromAsyncStorage()
          setHasMigrated(true)
        } catch (e) {
          // TODO: fall back to AsyncStorage? Wipe storage clean and use MMKV? Crash app?
        }
      })
    }
  }, [])

  return hasMigrated
}

/**
 * Migrates data from FileSystem to MMKV storage
 * Unlike AsyncStorage migration, this does NOT delete the original data from FileSystem
 */
export async function migrateFromFileSystemStorage(): Promise<void> {
  console.log('[Storage] Migrating from FileSystem -> MMKV...')
  const start = global.performance.now()

  try {
    // Get the file from persistStore/root
    const filePath = `${FileSystem.documentDirectory}persistStore/root`
    const fileInfo = await FileSystem.getInfoAsync(filePath)

    if (fileInfo.exists) {
      try {
        const content = await FileSystem.readAsStringAsync(filePath)
        const fileStorageContent = JSON.parse(content)
        const mmkvStorageContent = JSON.parse(storage.getString('root') || '{}')

        const mergedStorageContent = deepmerge(mmkvStorageContent, fileStorageContent)
        storage.set('root', JSON.stringify(mergedStorageContent))

        console.log(`[Storage] Migrated root key from FileSystem to MMKV`)
      } catch (readError) {
        console.error('Error reading or parsing persistStore file:', readError)
        throw readError
      }
    } else {
      console.log('[Storage] PersistStore file does not exist at path:', filePath)
    }

    // Mark migration as complete
    storage.set('hasMigratedFromFileSystem', true)

    const end = global.performance.now()
    console.log(`[Storage] Migrated from FileSystem -> MMKV in ${end - start}ms!`)
  } catch (error) {
    console.error('Error during FileSystem to MMKV migration:', error)
    throw error
  }
}

/**
 * Hook to handle migration from FileSystem to MMKV
 * Returns whether the migration has completed
 */
export const useMigrateFromFileSystemStorage = () => {
  const [hasMigrated, setHasMigrated] = useState(hasMigratedFromFileSystem)

  useEffect(() => {
    if (!hasMigratedFromFileSystem) {
      InteractionManager.runAfterInteractions(async () => {
        try {
          await migrateFromFileSystemStorage()
          setHasMigrated(true)
          // Note: No restart needed - state update is sufficient to continue app flow
        } catch (e) {
          console.error('Failed to migrate from FileSystem to MMKV:', e)
          // We don't need to fall back since we're not deleting the original data
        }
      })
    }
  }, [])

  return hasMigrated
}

export const mmkvStorage: Storage = {
  setItem: (key, value) => {
    storage.set(key, value)
    return Promise.resolve(true)
  },
  getItem: key => {
    const value = storage.getString(key)
    return Promise.resolve(value)
  },
  removeItem: key => {
    storage.remove(key)
    return Promise.resolve()
  },
}

/**
 * Hook to handle migration of databases to language folders
 * This moves existing databases from SQLite/ to SQLite/fr/ or SQLite/en/
 * and TRESOR to SQLite/shared/
 */
export const useMigrateToLanguageFolders = () => {
  const [hasMigrated, setHasMigrated] = useState(hasMigratedToLanguageFolders)

  useEffect(() => {
    if (!hasMigratedToLanguageFolders) {
      InteractionManager.runAfterInteractions(async () => {
        try {
          // Import dynamically to avoid circular dependencies
          const { migrateToLanguageFolders } = await import('~helpers/databaseMigration')
          const { getLanguage } = await import('~i18n')

          // Use current UI language as the target for migration
          const currentLang = getLanguage()
          await migrateToLanguageFolders(currentLang)

          storage.set('hasMigratedToLanguageFolders', true)
          setHasMigrated(true)
        } catch (e) {
          console.error('Failed to migrate databases to language folders:', e)
          // Mark as migrated anyway to avoid blocking the app
          // The migration will effectively be skipped and files will be at old locations
          storage.set('hasMigratedToLanguageFolders', true)
          setHasMigrated(true)
        }
      })
    }
  }, [])

  return hasMigrated
}
