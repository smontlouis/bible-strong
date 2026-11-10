import type { useRouter } from 'expo-router'

import { ASSISTANT_PATH } from './assistantSheetContext'

type Router = ReturnType<typeof useRouter>

export const OPEN_ASSISTANT_EVENT = 'bible-strong:open-assistant'

/**
 * Leads from a page back to the assistant, for the question Premium has just opened: back to its
 * sheet when the page was opened from it, to its page otherwise.
 */
export const returnToAssistant = (router: Router, from?: string) => {
  if (from === 'assistant' && router.canGoBack()) router.back()
  else router.push(ASSISTANT_PATH)
}
