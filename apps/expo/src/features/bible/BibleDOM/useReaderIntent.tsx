import { createContext, useContext, type ReactNode } from 'react'
import type {
  ReaderIntent,
  ReaderIntentHandler,
  ReaderOutcome,
} from '~features/bible/readerIntent/types'

type ReaderIntentContextValue = {
  tabId: string
  onReaderIntent: ReaderIntentHandler
}

const ReaderIntentContext = createContext<ReaderIntentContextValue | undefined>(undefined)

export const ReaderIntentProvider = ({
  tabId,
  onReaderIntent,
  children,
}: ReaderIntentContextValue & { children: ReactNode }) => (
  <ReaderIntentContext.Provider value={{ tabId, onReaderIntent }}>
    {children}
  </ReaderIntentContext.Provider>
)

/**
 * Sends a Reader intent stamped with the Tab the page shows (ADR-0098) and resolves to its
 * outcome. A bridge that fails resolves to `failed`: the page never has to catch.
 */
export const useReaderIntent = () => {
  const context = useContext(ReaderIntentContext)
  if (!context) throw new Error('useReaderIntent must be used within a ReaderIntentProvider')
  const { tabId, onReaderIntent } = context

  return (intent: ReaderIntent): Promise<ReaderOutcome> =>
    onReaderIntent({ tabId, intent }).catch(() => ({ status: 'failed' }) as const)
}
