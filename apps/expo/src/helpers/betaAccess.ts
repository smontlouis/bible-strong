/**
 * The beta list, `EXPO_PUBLIC_AI_BETA_UIDS`: Firebase uids of the accounts that see the features
 * not yet open to everyone, the study assistant and Premium. It only shows or hides them; the
 * services authorize on their own. It is bundled client metadata, not a secret.
 */
export const parseBetaUids = (value?: string) =>
  new Set(
    String(value || '')
      .split(',')
      .map(uid => uid.trim())
      .filter(uid => /^[A-Za-z0-9]{20,128}$/.test(uid))
  )

const betaUids = parseBetaUids(process.env.EXPO_PUBLIC_AI_BETA_UIDS)

export const hasBetaAccess = (uid?: string | null, allowedUids: ReadonlySet<string> = betaUids) =>
  Boolean(uid && allowedUids.has(uid))
