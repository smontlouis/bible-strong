// Web shim for @react-native-firebase/auth
// Uses Firebase JS SDK instead of native module

import { firebaseApp } from './firebase-web-init'
import {
  getAuth as getAuthWeb,
  onAuthStateChanged as onAuthStateChangedWeb,
  signInWithCredential as signInWithCredentialWeb,
  signInWithEmailAndPassword as signInWithEmailAndPasswordWeb,
  createUserWithEmailAndPassword as createUserWithEmailAndPasswordWeb,
  sendPasswordResetEmail as sendPasswordResetEmailWeb,
  signOut as signOutWeb,
  GoogleAuthProvider as GoogleAuthProviderWeb,
  OAuthProvider,
} from 'firebase/auth'

// Re-export everything from Firebase JS SDK
export const getAuth = () => getAuthWeb(firebaseApp)
export const onAuthStateChanged = onAuthStateChangedWeb
export const signInWithCredential = signInWithCredentialWeb
export const signInWithEmailAndPassword = signInWithEmailAndPasswordWeb
export const createUserWithEmailAndPassword = createUserWithEmailAndPasswordWeb
export const sendPasswordResetEmail = sendPasswordResetEmailWeb
export const signOut = signOutWeb
export const GoogleAuthProvider = GoogleAuthProviderWeb

// Apple auth provider for web
export const AppleAuthProvider = {
  credential: (identityToken: string, nonce?: string) => {
    const provider = new OAuthProvider('apple.com')
    return provider.credential({
      idToken: identityToken,
      rawNonce: nonce,
    })
  },
}

export default {
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  AppleAuthProvider,
}
