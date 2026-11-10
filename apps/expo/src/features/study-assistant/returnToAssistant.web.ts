import type { useRouter } from 'expo-router'

type Router = ReturnType<typeof useRouter>

/** Asks the web assistant's window to open (`AssistantLauncher.web.tsx` listens). */
export const OPEN_ASSISTANT_EVENT = 'bible-strong:open-assistant'

/**
 * On the Web and in the desktop app, the assistant is a window over the workspace: the page goes
 * back to where the reader was, and the window opens there.
 */
export const returnToAssistant = (router: Router, _from?: string) => {
  if (router.canGoBack()) router.back()
  else router.replace('/')
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))
}
