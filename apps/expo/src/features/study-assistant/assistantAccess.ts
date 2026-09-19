export const parseAssistantBetaUids = (value?: string) =>
  new Set(
    String(value || '')
      .split(',')
      .map(uid => uid.trim())
      .filter(uid => /^[A-Za-z0-9]{20,128}$/.test(uid))
  )

export const hasAssistantBetaAccess = (
  uid?: string | null,
  allowedUids: ReadonlySet<string> = new Set()
) => Boolean(uid && allowedUids.has(uid))
