import { getAuth, signOut } from '@react-native-firebase/auth'
import * as FileSystem from 'expo-file-system/legacy'
import * as Updates from 'expo-updates'

import { closeBiblesDb } from '~helpers/biblesDb'
import { storage } from '~helpers/storage'
import { persistor } from '~redux/store'

/**
 * DEV-ONLY: Completely resets the app to a pristine state.
 * - Signs out the user from Firebase
 * - Closes all SQLite connections
 * - Deletes every file in the document directory (databases, JSON, backups…)
 * - Clears MMKV storage
 * - Purges redux-persist
 * - Reloads the app
 */
export const nukeApp = async (): Promise<void> => {
  if (!__DEV__) {
    console.warn('[Nuke] Refused to nuke: not in dev mode')
    return
  }

  console.log('[Nuke] Starting full app reset…')

  // 1. Sign out from Firebase (ignore errors if not logged in)
  try {
    await signOut(getAuth())
  } catch (e) {
    console.log('[Nuke] signOut failed (probably not logged in):', e)
  }

  // 2. Close open SQLite connections so file deletion doesn't corrupt handles
  try {
    await closeBiblesDb()
  } catch (e) {
    console.log('[Nuke] closeBiblesDb failed:', e)
  }

  // 3. Wipe everything under the document directory
  try {
    const docDir = FileSystem.documentDirectory
    if (docDir) {
      const entries = await FileSystem.readDirectoryAsync(docDir)
      for (const entry of entries) {
        await FileSystem.deleteAsync(`${docDir}${entry}`, { idempotent: true })
      }
    }
  } catch (e) {
    console.log('[Nuke] FileSystem wipe failed:', e)
  }

  // 4. Purge redux-persist first so it doesn't rewrite MMKV on unmount
  try {
    await persistor.purge()
  } catch (e) {
    console.log('[Nuke] persistor.purge failed:', e)
  }

  // 5. Clear all MMKV keys
  try {
    storage.clearAll()
  } catch (e) {
    console.log('[Nuke] storage.clearAll failed:', e)
  }

  // 6. Reload the app
  console.log('[Nuke] Done. Reloading…')
  await Updates.reloadAsync()
}
