import { hasBetaAccess } from '~helpers/betaAccess'

export const assistantAvailable = Boolean(process.env.EXPO_PUBLIC_AI_API_URL)

export const assistantAccessible = (uid?: string | null) => assistantAvailable && hasBetaAccess(uid)
