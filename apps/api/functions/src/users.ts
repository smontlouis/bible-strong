// Note: Auth triggers restent en v1 car v2 nécessite Identity Platform
import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { deleteStudyFiles } from './studyFiles'

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
  failurePolicy: true,
}

export const deleteUser = functions
  .runWith(deleteUserRuntimeOpts)
  .auth.user()
  .onDelete(async (user) => {
    const db = admin.firestore()
    const userRef = db.collection('users').doc(user.uid)

    async function deleteDocumentTree(ref: admin.firestore.DocumentReference) {
      // Keep the parent discoverable if deletion of a descendant fails.
      // recursiveDelete also covers descendants with missing parent documents.
      for (const subcollection of await ref.listCollections()) {
        await db.recursiveDelete(subcollection)
      }
      await ref.delete()
    }

    // Studies live outside users/{uid}. Process bounded pages, including both
    // private and published studies, and query again after each deleted page.
    const ownedStudies = db.collection('studies').where('user.id', '==', user.uid).limit(100)
    while (true) {
      const page = await ownedStudies.get()
      if (page.empty) break
      for (const study of page.docs) {
        // Files first: if Storage fails, the study remains discoverable on retry.
        await deleteStudyFiles(study.id)
        await deleteDocumentTree(study.ref)
      }
    }

    await deleteDocumentTree(userRef)
    console.log('Account data and owned studies deleted')
  })
