import {
  type AssistantOpening,
  hasOpeningAccess,
  useAssistantOpening,
} from '~helpers/assistantOpening'

export const assistantAvailable = Boolean(process.env.EXPO_PUBLIC_AI_API_URL)

/**
 * Whether the assistant shows: to an account when it is open to everyone or on the beta list, and
 * to a visitor once it is open to everyone (2026-11-15), so that Strobi is found before signing in.
 * A visitor asks nothing: the assistant offers to sign in.
 */
export const assistantAccessible = (opening: AssistantOpening, uid?: string | null) =>
  assistantAvailable && (uid ? hasOpeningAccess(opening, uid) : opening.open)

/** Whether this account, or this visitor, sees the assistant. */
export const useAssistantAccessible = (uid?: string | null) =>
  assistantAccessible(useAssistantOpening(), uid)
