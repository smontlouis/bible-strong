import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudyEvent, ToolActivity } from '@bible-strong/ai-contract/contract'
import { useSetAtom, useStore } from 'jotai'
import { usePathname } from 'expo-router'
import { useExternalStoreRuntime } from '@assistant-ui/react-native'
import type { StudySource, StudyWidget } from '@bible-strong/ai-contract/contract'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { ASSISTANT_PATH, assistantPageAtom, type AssistantSheet } from '../assistantSheetContext'
import type { LiveDictationAdapter } from '../dictationAdapter'
import type { Conversation, LocalMessage } from '../conversations'
import { errorTranslationKey } from '../conversationRun'
import { convertMessage } from '../messageRuntime'
import { statusProgressKey } from '../studySteps'
import type { AssistantSession } from '../useAssistantSession'
import { scriptedRequest } from './scriptedAnswers'

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

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('INTERRUPTED'))
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('INTERRUPTED'))
      },
      { once: true }
    )
  })

/**
 * A run that goes wrong, for Strobi's states (2026-11-14): a search, a read that fails, another
 * read, then the service gives up.
 */
const failingRequest = async (signal: AbortSignal, emit: (event: StudyEvent) => void) => {
  emit({ type: 'status', message: 'analyzing' })
  await wait(900, signal)
  emit({ type: 'status', message: 'searching' })
  const search = { callId: 'demo-search', name: 'search_library', request: '{"query":"repos"}' }
  emit({ type: 'tool', ...search, result: '', state: 'running' })
  await wait(1200, signal)
  emit({ type: 'tool', ...search, result: 'ok', state: 'complete', summary: { count: 9 } })
  emit({ type: 'status', message: 'reading' })
  const broken = {
    callId: 'demo-broken',
    name: 'read_commentary',
    request: '{"reference":"Hébreux 4"}',
  }
  emit({ type: 'tool', ...broken, result: '', state: 'running' })
  await wait(1000, signal)
  emit({ type: 'tool', ...broken, result: 'unavailable', state: 'error' })
  await wait(1600, signal)
  const passage = {
    callId: 'demo-passage',
    name: 'read_passage',
    request: '{"reference":"Hébreux 4:9-11"}',
  }
  emit({ type: 'tool', ...passage, result: '', state: 'running' })
  await wait(1200, signal)
  emit({ type: 'tool', ...passage, result: 'ok', state: 'complete' })
  emit({ type: 'status', message: 'thinking' })
  await wait(1400, signal)
  throw new Error('UNAVAILABLE')
}

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
  const { t } = useTranslation()
  // Questions asked here play a scripted run, to see Strobi go through its states: one that
  // mentions an error ("erreur", "error") goes wrong.
  const [asked, setAsked] = useState<LocalMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [progressKey, setProgressKey] = useState('')
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const base = conversationOf(exchanges)
  const current = { ...base, messages: [...base.messages, ...asked] }
  const send = async (question: string) => {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const id = `run-${Date.now()}`
    let answer: LocalMessage = {
      id: `${id}-a`,
      role: 'assistant',
      text: '',
      state: 'streaming',
      createdAt: Date.now(),
    }
    let tools: ToolActivity[] = []
    const publishAnswer = (patch: Partial<LocalMessage>) => {
      answer = { ...answer, ...patch }
      setAsked(previous => [...previous.filter(message => message.id !== answer.id), answer])
    }
    setAsked(previous => [
      ...previous,
      { id: `${id}-q`, role: 'user', text: question, state: 'complete', createdAt: Date.now() },
      answer,
    ])
    setBusy(true)
    setError('')
    setProgressKey('assistant.preparing')
    const emit = (event: StudyEvent) => {
      if (controller.signal.aborted) return
      if (event.type === 'status') setProgressKey(statusProgressKey(event.message))
      if (event.type === 'tool') {
        const { type: _type, ...activity } = event
        tools = tools.some(tool => tool.callId === activity.callId)
          ? tools.map(tool => (tool.callId === activity.callId ? activity : tool))
          : [...tools, activity]
        publishAnswer({ tools })
      }
      if (event.type === 'widget')
        publishAnswer({ widgets: [...(answer.widgets || []), event.widget] })
      if (event.type === 'delta') {
        setProgressKey('assistant.writing')
        publishAnswer({ text: answer.text + event.text })
      }
    }
    try {
      await wait(1200, controller.signal)
      if (/erreur|error/i.test(question)) await failingRequest(controller.signal, emit)
      else
        await scriptedRequest(
          exchanges.map(({ answer: text, widgets, followUps }) => ({
            answer: text,
            widgets,
            followUps,
          }))
        )({} as never, controller.signal, emit)
      publishAnswer({ state: 'complete' })
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      publishAnswer({ state: code === 'INTERRUPTED' ? 'interrupted' : 'error' })
      setError(errorTranslationKey(code))
    } finally {
      active.current = null
      setBusy(false)
      setProgressKey('')
    }
  }
  const session = {
    conversations: [current],
    current,
    ready: true,
    storageError: false,
    setStorageError: noop,
    busy,
    followUps: busy || asked.length ? [] : (exchanges.at(-1)?.followUps ?? []),
    error,
    retrying: false,
    progress: progressKey ? t(progressKey) : '',
    progressKey,
    // The demo stands for an account that already agreed: its composer and shortcuts show.
    consent: { status: 'granted', grant: noop, decline: noop },
    context: null,
    detachContext: noop,
    attachContext: noop,
    send,
    cancel: () => active.current?.abort(),
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
    isRunning: busy,
    onNew: async message => {
      await send(
        message.content.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('\n')
      )
    },
    onCancel: async () => active.current?.abort(),
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
