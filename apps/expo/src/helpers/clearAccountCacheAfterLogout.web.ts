import { clearIndexedDbPersistence, terminate } from 'firebase/firestore'
import { persistor } from '~redux/store'
import { firebaseDb } from './firebase'

// A browser may be shared: the documents of the account that signed out leave the Firestore
// cache. Firestore cannot be used again once terminated, so the page reloads, signed out.
export const clearAccountCacheAfterLogout = async (): Promise<void> => {
  await persistor.flush()
  try {
    await terminate(firebaseDb)
    await clearIndexedDbPersistence(firebaseDb)
  } catch (error) {
    // Another tab still holds the cache; the last tab to sign out clears it.
    console.warn('[Logout] Firestore cache kept by another tab', error)
  }
  window.location.reload()
}
