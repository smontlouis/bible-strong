import { createContext, useContext, type ReactNode } from 'react'
import type {
  ReaderIntent,
  ReaderIntentHandler,
  ReaderOutcome,
  ReaderPageSignal,
  ReaderPageSignalHandler,
} from '~features/bible/readerIntent/types'

type ReaderIntentContextValue = {
  tabId: string
  onReaderIntent: ReaderIntentHandler
  onPageSignal: ReaderPageSignalHandler
}

const ReaderIntentContext = createContext<ReaderIntentContextValue | undefined>(undefined)

export const ReaderIntentProvider = ({
  tabId,
  onReaderIntent,
  onPageSignal,
  children,
}: ReaderIntentContextValue & { children: ReactNode }) => (
  <ReaderIntentContext.Provider value={{ tabId, onReaderIntent, onPageSignal }}>
    {children}
  </ReaderIntentContext.Provider>
)

const useReaderIntentContext = (hook: string) => {
  const context = useContext(ReaderIntentContext)
  if (!context) throw new Error(`${hook} must be used within a ReaderIntentProvider`)
  return context
}

/**
 * Sends a Reader intent stamped with the Tab the page shows (ADR-0098) and resolves to its
 * outcome. A bridge that fails resolves to `failed`: the page never has to catch.
 */
export const useReaderIntent = () => {
  const { tabId, onReaderIntent } = useReaderIntentContext('useReaderIntent')

  return (intent: ReaderIntent): Promise<ReaderOutcome> =>
    onReaderIntent({ tabId, intent }).catch(() => ({ status: 'failed' }) as const)
}

/**
 * Tells the application what the page itself does: mounted, an overlay open or closed, a message
 * for the reader. A signal is not stamped with the Tab and resolves to nothing.
 */
export const useReaderPageSignal = () => {
  const { onPageSignal } = useReaderIntentContext('useReaderPageSignal')

  return (signal: ReaderPageSignal): void => {
    Promise.resolve(onPageSignal(signal)).catch(console.error)
  }
}
