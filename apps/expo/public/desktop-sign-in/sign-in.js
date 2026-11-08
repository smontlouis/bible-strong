// Signs the reader in for the desktop app, in their own browser (ADR-0107).
//
// The app opens this page with the port of a one-time listener on 127.0.0.1 and a random state.
// The reader signs in with Google or Apple here, in a Firebase instance kept in memory so the
// web workspace's own session is untouched; the Application API exchanges that fresh sign-in
// for a custom token, and the browser goes back to the app with it.
//
// A static page, outside the bundle: Firebase comes from its CDN, pinned to the app's version.
/* eslint-disable import/no-unresolved */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js'
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserPopupRedirectResolver,
  getAdditionalUserInfo,
  inMemoryPersistence,
  initializeAuth,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js'

const TEXT = {
  fr: {
    eyebrow: 'Bible Strong pour ordinateur',
    title: 'Connexion',
    body: 'Connectez-vous ici, puis revenez dans l’application : elle ouvrira votre compte.',
    google: 'Continuer avec Google',
    apple: 'Continuer avec Apple',
    cancel: 'Annuler',
    working: 'Connexion en cours…',
    returning: 'Retour dans l’application…',
    failed: 'La connexion n’a pas abouti. Réessayez.',
    invalid: 'Ce lien de connexion n’est pas valide. Recommencez depuis l’application.',
  },
  en: {
    eyebrow: 'Bible Strong for desktop',
    title: 'Sign in',
    body: 'Sign in here, then go back to the app: it will open your account.',
    google: 'Continue with Google',
    apple: 'Continue with Apple',
    cancel: 'Cancel',
    working: 'Signing in…',
    returning: 'Going back to the app…',
    failed: 'Signing in did not work. Try again.',
    invalid: 'This sign-in link is not valid. Start again from the app.',
  },
}

const params = new URLSearchParams(location.search)
const lang = params.get('lang') === 'en' ? 'en' : 'fr'
const text = TEXT[lang]
const providerId = params.get('provider')
const port = Number(params.get('port'))
const state = params.get('state') ?? ''

document.documentElement.lang = lang
document.title = `${text.title} – ${text.eyebrow}`
for (const element of document.querySelectorAll('[data-text]')) {
  element.textContent = text[element.dataset.text]
}
const continueButton = document.getElementById('continue')
const cancelButton = document.getElementById('cancel')
const status = document.getElementById('status')
continueButton.textContent = providerId === 'apple.com' ? text.apple : text.google

const valid =
  (providerId === 'google.com' || providerId === 'apple.com') &&
  Number.isInteger(port) &&
  port >= 1024 &&
  port <= 65535 &&
  /^[0-9a-f]{48}$/.test(state)

const backToApp = query => {
  location.replace(
    `http://127.0.0.1:${port}/callback?${new URLSearchParams({ state, ...query }).toString()}`
  )
}

const start = async () => {
  if (!valid) {
    status.textContent = text.invalid
    continueButton.hidden = true
    cancelButton.hidden = true
    return
  }
  cancelButton.addEventListener('click', () => backToApp({ error: 'cancelled' }))

  // Loaded before the click: a popup opened after an await is blocked by Safari.
  const config = await fetch('./config.json', { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error('DESKTOP_SIGN_IN_CONFIG_MISSING')
    return response.json()
  })
  const auth = initializeAuth(initializeApp(config, 'desktop-sign-in'), {
    persistence: inMemoryPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  })
  const provider =
    providerId === 'apple.com' ? new OAuthProvider('apple.com') : new GoogleAuthProvider()
  if (providerId === 'apple.com') provider.addScope('email')

  continueButton.disabled = false
  continueButton.addEventListener('click', async () => {
    continueButton.disabled = true
    status.textContent = text.working
    try {
      const result = await signInWithPopup(auth, provider)
      const response = await fetch(config.desktopSignInTokenUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await result.user.getIdToken()}` },
      })
      if (!response.ok) throw new Error(`DESKTOP_SIGN_IN_TOKEN_${response.status}`)
      const { token } = await response.json()
      status.textContent = text.returning
      backToApp({ token, isNewUser: getAdditionalUserInfo(result)?.isNewUser ? '1' : '0' })
    } catch (error) {
      continueButton.disabled = false
      status.textContent = error?.code === 'auth/popup-closed-by-user' ? '' : text.failed
      console.error(error)
    }
  })
}

start().catch(error => {
  status.textContent = text.failed
  console.error(error)
})
