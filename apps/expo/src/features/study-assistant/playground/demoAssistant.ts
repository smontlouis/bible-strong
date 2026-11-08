import { useEffect, useState } from 'react'
import { useSetAtom, useStore } from 'jotai'
import { usePathname } from 'expo-router'
import { useExternalStoreRuntime } from '@assistant-ui/react-native'
import type { StudySource, StudyWidget } from '@bible-strong/ai-contract/contract'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { ASSISTANT_PATH, assistantPageAtom, type AssistantSheet } from '../assistantSheetContext'
import type { LiveDictationAdapter } from '../dictationAdapter'
import type { Conversation } from '../conversations'
import { convertMessage } from '../messageRuntime'
import type { AssistantSession } from '../useAssistantSession'

export type DemoExchange = {
  question: string
  answer: string
  widgets: StudyWidget[]
  followUps?: string[]
}

const conversationOf = (exchanges: DemoExchange[]): Conversation => ({
  id: 'demo',
  title: 'Démonstration des cartes',
  updatedAt: 0,
  messages: exchanges.flatMap((exchange, index) => [
    {
      id: `q${index}`,
      role: 'user' as const,
      text: exchange.question,
      state: 'complete' as const,
      createdAt: index,
    },
    {
      id: `a${index}`,
      role: 'assistant' as const,
      text: exchange.answer,
      state: 'complete' as const,
      widgets: exchange.widgets,
      createdAt: index,
    },
  ]),
})

const noop = () => {}

/**
 * Development only: when no account has the assistant here (a simulator signed out), the
 * real assistant page shows these answers, so its layout and its cards can be checked.
 */
export function useDemoAssistant(exchanges: DemoExchange[]) {
  // Read once, not subscribed: this hook publishes the atom itself after every render.
  const store = useStore()
  const [owned] = useState(() => !store.get(assistantPageAtom))
  const publish = useSetAtom(assistantPageAtom)
  const pushRoute = usePushRouteOnce()
  const open = usePathname() === ASSISTANT_PATH
  const [historyOpen, setHistoryOpen] = useState(false)
  const [source, setSource] = useState<StudySource | null>(null)
  const current = conversationOf(exchanges)
  const session = {
    conversations: [current],
    current,
    ready: true,
    storageError: false,
    setStorageError: noop,
    busy: false,
    followUps: exchanges.at(-1)?.followUps ?? [],
    error: '',
    retrying: false,
    progress: '',
    context: null,
    detachContext: noop,
    attachContext: noop,
    send: async () => {},
    cancel: noop,
    retry: noop,
    threadList: {
      threadId: current.id,
      threads: [{ id: current.id, status: 'regular' as const, title: current.title, custom: {} }],
      onSwitchToNewThread: noop,
      onSwitchToThread: noop,
      onRename: noop,
      onDelete: noop,
    },
  } as unknown as AssistantSession
  const runtime = useExternalStoreRuntime({
    messages: current.messages,
    convertMessage,
    isRunning: false,
    onNew: async () => {},
  })
  const sheet: AssistantSheet = {
    session,
    liveContext: null,
    open,
    historyOpen,
    setHistoryOpen,
    close: noop,
    navigate: route => pushRoute(route),
    showSource: setSource,
    source,
    dictation: { cancel: noop } as unknown as LiveDictationAdapter,
    dictationState: 'idle',
  }
  useEffect(() => {
    if (owned) publish({ sheet, runtime })
  })
  useEffect(() => () => (owned ? publish(null) : undefined), [owned, publish])
  return { available: owned, open: () => pushRoute({ pathname: ASSISTANT_PATH }) }
}
