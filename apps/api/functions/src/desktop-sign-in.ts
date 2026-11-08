import { onRequest } from 'firebase-functions/v2/https'

const admin = require('firebase-admin')

/** The sign-in page of the web workspace, and its local development server. */
export const DESKTOP_SIGN_IN_ORIGINS = ['https://web.bible-strong.app', 'http://localhost:9090']

/** Long enough to read the page, short enough that an old browser session proves nothing. */
export const MAX_SIGN_IN_AGE_SECONDS = 5 * 60

/**
 * The desktop app signs a reader in through their own browser, since Google refuses OAuth in an
 * embedded webview (ADR-0107). The sign-in page proves a Google or Apple sign-in made moments
 * ago with its ID token and receives a custom token for the same account, which it hands to the
 * app on 127.0.0.1. The token signs in that account only and expires within the hour.
 */
export const createDesktopSignInToken = onRequest(
  {
    cors: DESKTOP_SIGN_IN_ORIGINS,
    invoker: 'public',
    maxInstances: 10,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' })
      return
    }
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    let decoded: { uid: string; auth_time: number }
    try {
      decoded = await admin.auth().verifyIdToken(authHeader.slice('Bearer '.length), true)
    } catch {
      res.status(401).json({ error: 'invalid_token' })
      return
    }
    if (Date.now() / 1000 - decoded.auth_time > MAX_SIGN_IN_AGE_SECONDS) {
      res.status(401).json({ error: 'stale_sign_in' })
      return
    }

    try {
      const token: string = await admin.auth().createCustomToken(decoded.uid)
      res.set('Cache-Control', 'no-store')
      res.json({ token })
    } catch (error) {
      console.error('createDesktopSignInToken failed', error)
      res.status(500).json({ error: 'token_failed' })
    }
  }
)
