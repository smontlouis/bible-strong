// Note: Auth triggers restent en v1 car v2 nécessite Identity Platform
import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'

export const createUser = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL, providerData, emailVerified } =
    user
  const db = admin.firestore()
  const userRef = db.collection('users').doc(uid)
  const userData = {
    id: uid,
    email,
    ...(displayName ? { displayName } : {}),
    photoURL,
    provider: providerData[0]?.providerId,
    emailVerified,
  }
  await userRef.set(userData, { merge: true })
})

const deleteUserRuntimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 540, // 9 minutes (max pour v1)
  memory: '1GB',
}

export const deleteUser = functions
  .runWith(deleteUserRuntimeOpts)
  .auth.user()
  .onDelete(async (user) => {
  const { uid } = user
  const db = admin.firestore()
  const userRef = db.collection('users').doc(uid)

  async function deleteCollection(
    collectionRef: admin.firestore.CollectionReference
  ) {
    const snapshot = await collectionRef.get()

    if (snapshot.empty) return

    const batches: admin.firestore.WriteBatch[] = []
    let currentBatch = db.batch()
    let operationCount = 0
    const batchSize = 500

    for (const doc of snapshot.docs) {
      const docSubcollections = await doc.ref.listCollections()
      for (const subcol of docSubcollections) {
        await deleteCollection(subcol)
      }

      currentBatch.delete(doc.ref)
      operationCount++

      if (operationCount === batchSize) {
        batches.push(currentBatch)
        currentBatch = db.batch()
        operationCount = 0
      }
    }

    if (operationCount > 0) {
      batches.push(currentBatch)
    }

    await Promise.all(batches.map((batch) => batch.commit()))
  }

  const subcollections = await userRef.listCollections()
  for (const subcol of subcollections) {
    await deleteCollection(subcol)
  }

  await userRef.delete()

  console.log(`User ${uid} and all subcollections deleted`)
})
