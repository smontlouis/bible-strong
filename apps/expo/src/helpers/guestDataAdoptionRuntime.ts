import { getAuth } from '@react-native-firebase/auth'

import { createGuestAdoptionRepository, type GuestAdoptionRemote } from '~helpers/guestDataAdoption'
import { batchWriteSubcollection } from '~helpers/firestoreSubcollections'
import { doc, firebaseDb, setDoc, updateDoc, waitForPendingWrites } from '~helpers/firebase'
import { storage } from '~helpers/storage'

export const guestAdoptionRepository = createGuestAdoptionRepository(storage)

export const firebaseGuestAdoptionRemote: GuestAdoptionRemote = {
  async writeSubcollection(userId, collection, documents, deleteIds = []) {
    await batchWriteSubcollection(
      userId,
      collection,
      {
        set: documents,
        delete: deleteIds,
        merge: true,
      },
      undefined,
      { diagnostics: 'aggregate-only' }
    )
  },
  async writeAccountDocument(userId, document) {
    const userDocument = doc(firebaseDb, 'users', userId)
    await setDoc(userDocument, { id: userId }, { merge: true })
    const bible = document.bible as { settings: Record<string, unknown> }
    await updateDoc(userDocument, {
      'bible.settings': bible.settings,
      plan: document.plan,
    })
  },
  async waitForPendingWrites() {
    await waitForPendingWrites(firebaseDb)
  },
}

export const getAuthenticatedUserId = (): string | undefined => getAuth().currentUser?.uid
