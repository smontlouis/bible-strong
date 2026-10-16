import { getResourceAppCheckToken } from '~helpers/resourceAppCheck'

/**
 * Sign-in and the beta allowlist authorize the assistant; App Check is optional there. A device
 * without an attestation, such as a simulator whose debug token is not registered, still asks.
 */
export async function assistantAuthHeaders(user: {
  getIdToken: () => Promise<string>
}): Promise<Record<string, string>> {
  const [token, appCheck] = await Promise.all([
    user.getIdToken(),
    getResourceAppCheckToken().catch(() => undefined),
  ])
  return {
    Authorization: `Bearer ${token}`,
    ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}),
  }
}
