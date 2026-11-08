import { openUrl } from '@tauri-apps/plugin-opener'
import {
  signInWithCustomToken,
  type Auth,
  type GoogleAuthProvider,
  type OAuthProvider,
} from 'firebase/auth'

import { invoke } from '~desktop/bridge'
import i18n from '~i18n'

import { toast } from './toast'
// Types only: in the desktop build `./providerSignIn` resolves to this file.
import type { ProviderSignInResult } from './providerSignIn'

export type { ProviderSignInResult }

export const PROVIDER_SIGN_IN_CANCELLED = 'auth/popup-closed-by-user'

const SIGN_IN_PAGE =
  process.env.EXPO_PUBLIC_DESKTOP_SIGN_IN_URL ?? 'https://web.bible-strong.app/desktop-sign-in/'

type SignInOutcome = { token: string | null; isNewUser: boolean; error: string | null }

const failure = (code: string) => Object.assign(new Error(code), { code })

/**
 * Google refuses OAuth inside the app's webview, so the desktop app signs in through the
 * reader's own browser (ADR-0107): the sign-in page of the web workspace hands a one-time
 * custom token back to the shell on 127.0.0.1 (`apps/desktop/src-tauri/src/sign_in.rs`).
 */
export const signInWithProvider = async (
  auth: Auth,
  provider: GoogleAuthProvider | OAuthProvider
): Promise<ProviderSignInResult> => {
  const { port, state } = await invoke<{ port: number; state: string }>('sign_in_start')
  const page = new URL(SIGN_IN_PAGE)
  page.searchParams.set('provider', provider.providerId)
  page.searchParams.set('port', String(port))
  page.searchParams.set('state', state)
  page.searchParams.set('lang', i18n.language === 'en' ? 'en' : 'fr')
  await openUrl(page.toString())

  const waiting = toast(i18n.t('desktop.signIn.continueInBrowser'), {
    duration: Infinity,
    action: {
      label: i18n.t('desktop.signIn.cancel'),
      onClick: () => void invoke('sign_in_cancel'),
    },
  })
  let outcome: SignInOutcome
  try {
    outcome = await invoke<SignInOutcome>('sign_in_result')
  } finally {
    toast.dismiss(waiting)
  }
  if (!outcome.token) {
    throw failure(
      outcome.error === 'cancelled' ? PROVIDER_SIGN_IN_CANCELLED : 'auth/desktop-sign-in-failed'
    )
  }
  const credential = await signInWithCustomToken(auth, outcome.token)
  return { user: credential.user, isNewUser: outcome.isNewUser }
}
