import { createContext, useContext } from 'react'
import { atom } from 'jotai'
import type { AssistantRuntime } from '@assistant-ui/react-native'
import type { StudySource } from '@bible-strong/ai-contract/contract'
import type { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { ReadingContext } from './conversations'
import type { LiveDictationAdapter } from './dictationAdapter'
import type { AssistantSession } from './useAssistantSession'

/** The native assistant page: a form sheet on iOS, a page on Android (ADR-0086 surfaces). */
export const ASSISTANT_PATH = '/study-assistant'

export type DictationState = 'idle' | 'starting' | 'listening' | 'stopping' | 'error'

export type AssistantSheet = {
  session: AssistantSession
  liveContext: ReadingContext | null
  /** Whether the assistant page is the screen in front: animated content only runs then. */
  open: boolean
  historyOpen: boolean
  setHistoryOpen: (open: boolean) => void
  close: () => void
  /** Pushes a route above the assistant page, which stays below it with the conversation. */
  navigate: (route: Parameters<ReturnType<typeof usePushRouteOnce>>[0]) => void
  /** Shows the excerpt the answer cites, with a way to open the full resource. */
  showSource: (source: StudySource | null) => void
  source: StudySource | null
  dictation: LiveDictationAdapter
  dictationState: DictationState
}

/**
 * The conversation lives at the root, so it keeps streaming when the page closes; the page,
 * a route of its own, reads it from here.
 */
export const assistantPageAtom = atom<{ sheet: AssistantSheet; runtime: AssistantRuntime } | null>(
  null
)

export const AssistantSheetContext = createContext<AssistantSheet | null>(null)

/** The composer floats over the bottom of the conversation, which keeps room for its height. */
export const ComposerInsetContext = createContext<{
  height: number
  setHeight: (height: number) => void
}>({
  height: 0,
  setHeight: () => {},
})

export function useAssistantSheet(): AssistantSheet {
  const value = useContext(AssistantSheetContext)
  if (!value) throw new Error('The assistant sheet context is only available inside the sheet')
  return value
}
