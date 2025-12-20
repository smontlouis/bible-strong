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
