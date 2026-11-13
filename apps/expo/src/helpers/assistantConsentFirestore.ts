import { deleteDoc, doc, firebaseDb, onSnapshot, setDoc } from './firebase'

type Unsubscribe = () => void

// One document per account, under the account's own folder, which its owner may write
// (firestore.rules) and which deleting the account erases with the rest.
const consentRef = (account: string) =>
  doc(firebaseDb, 'users', account, 'assistantSettings', 'aiConsent')

export function observeAssistantConsent(
  account: string,
  onChange: (data: unknown) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    consentRef(account),
    snapshot => onChange(snapshot.exists() ? snapshot.data() : null),
    onError
  )
}

export function saveAssistantConsent(account: string, version: number, acceptedAt: number) {
  return setDoc(consentRef(account), { version, acceptedAt })
}

export function deleteAssistantConsent(account: string) {
  return deleteDoc(consentRef(account))
}
