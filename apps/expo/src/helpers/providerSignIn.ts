import {
  getAdditionalUserInfo,
  signInWithPopup,
  type Auth,
  type GoogleAuthProvider,
  type OAuthProvider,
  type User,
} from 'firebase/auth'

export type ProviderSignInResult = { user: User; isNewUser: boolean | undefined }

/** The reader closed the sign-in window: not an error to report. */
export const PROVIDER_SIGN_IN_CANCELLED = 'auth/popup-closed-by-user'

/** Google or Apple sign-in in the browser, in a popup. The desktop app has its own variant. */
export const signInWithProvider = async (
  auth: Auth,
  provider: GoogleAuthProvider | OAuthProvider
): Promise<ProviderSignInResult> => {
  const credential = await signInWithPopup(auth, provider)
  return { user: credential.user, isNewUser: getAdditionalUserInfo(credential)?.isNewUser }
}
