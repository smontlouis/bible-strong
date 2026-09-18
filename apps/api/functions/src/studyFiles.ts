import * as admin from 'firebase-admin'

// Use the Firestore document ID, never an editable field from its payload.
// Account cleanup and the Firestore delete trigger may both run for one study.
export const deleteStudyFiles = async (studyId: string): Promise<void> => {
  const bucket = admin.storage().bucket('bible-strong-app.appspot.com')
  await bucket.file(`images/studies/${studyId}.jpg`).delete({ ignoreNotFound: true })
  await bucket.file(`images/studies/${studyId}-whatsapp.jpg`).delete({ ignoreNotFound: true })
}
