import { createContext, useContext } from 'react'
import { atom } from 'jotai'
import type { StudySource } from '@bible-strong/ai-contract/contract'
import type { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { ReadingContext } from './conversations'
import type { LiveDictationAdapter } from './dictationAdapter'
import type { AssistantSession } from './useAssistantSession'

/** Incremented by any native surface that asks the assistant sheet to open. */
export const assistantOpenRequestAtom = atom(0)

export type DictationState = 'idle' | 'starting' | 'listening' | 'stopping' | 'error'

export type AssistantSheet = {
  session: AssistantSession
  liveContext: ReadingContext | null
  /** The sheet stays mounted while hidden: animated content only runs when it is shown. */
  open: boolean
  historyOpen: boolean
  setHistoryOpen: (open: boolean) => void
  close: () => void
  /** A native sheet cannot stay above a pushed screen: it closes first, then navigates. */
  navigate: (route: Parameters<ReturnType<typeof usePushRouteOnce>>[0]) => void
  /** Shows the excerpt the answer cites, with a way to open the full resource. */
  showSource: (source: StudySource) => void
  dictation: LiveDictationAdapter
  dictationState: DictationState
}

export const AssistantSheetContext = createContext<AssistantSheet | null>(null)

export function useAssistantSheet(): AssistantSheet {
  const value = useContext(AssistantSheetContext)
  if (!value) throw new Error('The assistant sheet context is only available inside the sheet')
  return value
}
