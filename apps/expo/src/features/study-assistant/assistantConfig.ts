import {
  type AssistantOpening,
  hasOpeningAccess,
  useAssistantOpening,
} from '~helpers/assistantOpening'

export const assistantAvailable = Boolean(process.env.EXPO_PUBLIC_AI_API_URL)

export const assistantAccessible = (opening: AssistantOpening, uid?: string | null) =>
  assistantAvailable && hasOpeningAccess(opening, uid)

/** Whether this account sees the assistant: open to everyone, or on the beta list. */
export const useAssistantAccessible = (uid?: string | null) =>
  assistantAccessible(useAssistantOpening(), uid)
