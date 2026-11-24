import { doc, firebaseDb, setDoc } from './firebase'

// One document per opinion, under the account's own folder, which its owner may write
// (firestore.rules) and which deleting the account erases with the rest. The team reads them
// across accounts as the collection group `assistantFeedback`.
const feedbackRef = (account: string, id: string) =>
  doc(firebaseDb, 'users', account, 'assistantFeedback', id)

/** Writes an opinion, or completes the one already given on the same answer. */
export function saveAssistantFeedback(account: string, id: string, data: Record<string, unknown>) {
  return setDoc(feedbackRef(account, id), data, { merge: true })
}
