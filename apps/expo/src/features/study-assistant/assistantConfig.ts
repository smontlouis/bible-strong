import { hasAssistantBetaAccess, parseAssistantBetaUids } from './assistantAccess'

const assistantBetaUids = parseAssistantBetaUids(process.env.EXPO_PUBLIC_AI_BETA_UIDS)

export const assistantAvailable = Boolean(process.env.EXPO_PUBLIC_AI_API_URL)

export const assistantAccessible = (uid?: string | null) =>
  assistantAvailable && hasAssistantBetaAccess(uid, assistantBetaUids)
