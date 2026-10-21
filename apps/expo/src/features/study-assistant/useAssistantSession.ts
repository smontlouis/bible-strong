import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssistantAction } from '@bible-strong/ai-contract/contract'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { askAssistant, captureAssistantPreferences, compactAssistant } from './client'
import { assistantAvailable } from './assistantConfig'
import { runConversation, type ConversationRequest } from './conversationRun'
import {
  assertConversationCapacity,
  loadFollowReadingPreference,
  newConversation,
  saveFollowReadingPreference,
  type Conversation,
  type LocalMessage,
  type ReadingContext,
} from './conversations'
import {
  deleteConversation,
  observeConversation,
  observeConversationIndex,
  renameConversation,
  saveConversation,
} from './conversationRepository'

type PreferenceStorage = Parameters<typeof loadFollowReadingPreference>[0]

const retryableErrors = [
  'assistant.unavailable',
  'assistant.interrupted',
  'assistant.modal.compactionFailed',
]

/**
 * Account-scoped conversation state shared by the web modal and the native sheet:
 * cloud history, the single cancellable run and the reading-context preference.
 * Presentation state (open panel, history view, dictation, diagnostics) stays in the host.
 */
export function useAssistantSession({
  account,
  signedIn,
  liveContext,
  preferenceStorage,
  createRequest,
  onAction,
  onRunStart,
  onThreadSwitch,
  onCurrentThreadDeleted,
}: {
  account: string
  signedIn: boolean
  liveContext: ReadingContext | null
  /** Read lazily so a host without device storage only fails inside the guarded effect. */
  preferenceStorage: () => PreferenceStorage
  /** Lets a host replace the transport for one run (development diagnostics). */
  createRequest?: (run: { isCurrent: () => boolean }) => ConversationRequest | undefined
  onAction: (action: AssistantAction) => void
  onRunStart?: () => void
  onThreadSwitch?: () => void
  onCurrentThreadDeleted?: () => void
}) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [current, setCurrent] = useState<Conversation>(() => newConversation())
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(false),
    [cloudIds, setCloudIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [retrying, setRetrying] = useState(false),
    [progress, setProgress] = useState('')
  const [followReading, setFollowReading] = useState(false),
    [pinned, setPinned] = useState<ReadingContext | null>(null)
  const active = useRef<AbortController | null>(null)
  const receivedInitialIndex = useRef(false)
  const context = followReading ? pinned || liveContext : null
  // The host passes a new function on each render: it must not restart the account's effects.
  const readPreferenceStorage = useEffectEvent(() => preferenceStorage())
  useEffect(() => {
    try {
      setFollowReading(loadFollowReadingPreference(readPreferenceStorage(), account))
    } catch {
      setStorageError(true)
    }
    const stop = observeConversationIndex(
      account,
      remote => {
        const ids = remote.map(conversation => conversation.id)
        setCloudIds(ids)
        setConversations(previous => {
          const localOnly = previous.filter(
            conversation => !ids.includes(conversation.id) && conversation.messages.length
          )
          return [
            ...localOnly,
            ...remote.map(conversation => {
              const local = previous.find(item => item.id === conversation.id)
              return local?.messages.length
                ? { ...conversation, messages: local.messages, memory: local.memory }
                : conversation
            }),
          ]
        })
        setCurrent(previous => {
          if (!receivedInitialIndex.current) {
            receivedInitialIndex.current = true
            return remote[0] || previous
          }
          const metadata = remote.find(item => item.id === previous.id)
          if (metadata)
            return previous.messages.length
              ? { ...previous, title: metadata.title, updatedAt: metadata.updatedAt }
              : metadata
          return previous
        })
        setStorageError(false)
        setReady(true)
      },
      () => {
        setStorageError(true)
        setReady(true)
      }
    )
    return () => {
      stop()
      active.current?.abort()
      active.current = null
    }
  }, [account])
  const currentIsCloud = cloudIds.includes(current.id)
  useEffect(() => {
    if (!currentIsCloud) return
    return observeConversation(
      account,
      current.id,
      conversation => {
        if (!conversation) {
          setConversations(previous => previous.filter(item => item.id !== current.id))
          setCloudIds(previous => previous.filter(item => item !== current.id))
          setCurrent(previous => (previous.id === current.id ? newConversation() : previous))
          return
        }
        if (active.current) return
        setCurrent(conversation)
        setConversations(previous => [
          conversation,
          ...previous.filter(item => item.id !== conversation.id),
        ])
      },
      () => setStorageError(true)
    )
  }, [account, current.id, currentIsCloud])
  useEffect(() => {
    if (!ready) return
    try {
      saveFollowReadingPreference(readPreferenceStorage(), account, followReading)
    } catch {
      setStorageError(true)
    }
  }, [account, followReading, ready])
  const publish = (conversation: Conversation) => {
    setCurrent(conversation)
    setConversations(previous => [conversation, ...previous.filter(c => c.id !== conversation.id)])
    if (conversation.messages.at(-1)?.state !== 'streaming') {
      void saveConversation(account, conversation)
        .then(() => setStorageError(false))
        .catch(() => setStorageError(true))
    }
  }
  const send = (
    text: string,
    source = current,
    readingContext = context,
    retryOf?: Pick<LocalMessage, 'id'>
  ) => {
    const question = text.trim()
    if (!question || active.current || !ready || (currentIsCloud && !current.messages.length))
      return
    if (!signedIn || getCurrentAuthUser()?.uid !== account) {
      setError('assistant.signIn')
      return
    }
    if (!assistantAvailable) {
      setError('assistant.unavailable')
      return
    }
    try {
      assertConversationCapacity(conversations, current)
    } catch {
      setStorageError(true)
      return
    }
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    onRunStart?.()
    return runConversation({
      conversation: source,
      question,
      context: readingContext,
      retryOf,
      preferences: captureAssistantPreferences(readingContext?.bibleVersion),
      controller,
      request: createRequest?.({ isCurrent: () => active.current === controller }) || askAssistant,
      compact: compactAssistant,
      isCurrent: () => active.current === controller,
      onUpdate: publish,
      onProgress: key => setProgress(t(key)),
      onError: key => setError(key),
      onAction,
    }).finally(() => {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
        setProgress('')
      }
    })
  }
  const startNewThread = () => {
    if (busy) return
    onThreadSwitch?.()
    setCurrent(newConversation())
    setError('')
  }
  const switchToThread = (id: string) => {
    if (busy) return
    const conversation = conversations.find(item => item.id === id)
    if (!conversation) return
    onThreadSwitch?.()
    setCurrent(conversation)
    setError('')
  }
  const deleteThread = (id: string) => {
    if (busy) return
    void deleteConversation(account, id)
      .then(() => {
        if (current.id === id) onCurrentThreadDeleted?.()
        setConversations(previous => previous.filter(conversation => conversation.id !== id))
        if (current.id === id) setCurrent(newConversation())
        setCloudIds(previous => previous.filter(item => item !== id))
      })
      .catch(() => setStorageError(true))
  }
  const renameThread = (id: string, title: string) => {
    const normalizedTitle = title.slice(0, 120)
    const updatedAt = Date.now()
    setConversations(previous =>
      previous.map(conversation =>
        conversation.id === id
          ? { ...conversation, title: normalizedTitle, updatedAt }
          : conversation
      )
    )
    if (current.id === id)
      setCurrent(previous => ({ ...previous, title: normalizedTitle, updatedAt }))
    void renameConversation(account, id, normalizedTitle, updatedAt).catch(() =>
      setStorageError(true)
    )
  }
  const changeFollowReading = (enabled: boolean) => {
    setFollowReading(enabled)
    if (!enabled) setPinned(null)
  }
  const failedQuestion = current.messages.at(-2)
  const retry =
    !busy && retryableErrors.includes(error) && failedQuestion?.role === 'user'
      ? () => {
          setRetrying(true)
          void Promise.resolve(
            send(
              failedQuestion.text,
              { ...current, messages: current.messages.slice(0, -2) },
              failedQuestion.context || null,
              failedQuestion
            )
          ).finally(() => setRetrying(false))
        }
      : undefined
  return {
    conversations,
    current,
    ready,
    storageError,
    setStorageError,
    busy,
    error,
    retrying,
    progress,
    pinned,
    setPinned,
    context,
    send,
    cancel: () => active.current?.abort(),
    retry,
    changeFollowReading,
    threadList: {
      threadId: current.id,
      threads: conversations.map(conversation => ({
        id: conversation.id,
        status: 'regular' as const,
        title: conversation.title,
        custom: {
          updatedAt: conversation.updatedAt,
          messageCount:
            conversation.summaryMessageCount === undefined
              ? conversation.messages.length
              : conversation.summaryMessageCount,
        },
      })),
      onSwitchToNewThread: startNewThread,
      onSwitchToThread: switchToThread,
      onRename: renameThread,
      onDelete: deleteThread,
    },
  }
}

export type AssistantSession = ReturnType<typeof useAssistantSession>
