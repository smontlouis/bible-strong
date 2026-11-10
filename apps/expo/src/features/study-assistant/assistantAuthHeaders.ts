import { getResourceAppCheckToken } from '~helpers/resourceAppCheck'

/**
 * Sign-in and the beta allowlist authorize the assistant; App Check is optional there. A device
 * without an attestation, such as a simulator whose debug token is not registered, still asks.
 */
export async function assistantAuthHeaders(user: {
  getIdToken: (forceRefresh?: boolean) => Promise<string>
  getIdTokenResult?: () => Promise<{ claims: Record<string, unknown> }>
  emailVerified?: boolean
}): Promise<Record<string, string>> {
  const [token, appCheck] = await Promise.all([
    idToken(user),
    getResourceAppCheckToken().catch(() => undefined),
  ])
  return {
    Authorization: `Bearer ${token}`,
    ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}),
  }
}

/**
 * The free questions need a verified address, which the service reads in the ID token. An address
 * verified after the token was issued is not in it yet; a fresh token carries it at once, rather
 * than when the token expires within the hour.
 */
async function idToken(user: Parameters<typeof assistantAuthHeaders>[0]) {
  const token = await user.getIdToken()
  if (!user.emailVerified || !user.getIdTokenResult) return token
  const { claims } = await user.getIdTokenResult()
  return claims.email_verified === false ? user.getIdToken(true) : token
}
