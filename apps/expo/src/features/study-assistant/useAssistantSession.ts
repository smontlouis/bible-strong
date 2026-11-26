import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssistantAction } from '@bible-strong/ai-contract/contract'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { askAssistant, captureAssistantPreferences, compactAssistant } from './client'
import { AnswerReveal } from './answerReveal'
import { useAiConsent } from './aiConsent'
import { assistantAvailable } from './assistantConfig'
import { runConversation, type ConversationRequest } from './conversationRun'
import type { Compactor } from './conversationMemory'
import {
  assertConversationCapacity,
  newConversation,
  type Conversation,
  type LocalMessage,
  type ReadingContext,
} from './conversations'
import {
  deleteConversation,
  observeConversation,
  observeConversationIndex,
  pinConversationContext,
  renameConversation,
  saveConversation,
} from './conversationRepository'

/**
 * Closed for less than this, the assistant reopens on the conversation the reader left: back from
 * a source, from Premium. Longer, and it opens on a new one, as after the app is started again.
 */
export const RESUME_WINDOW_MS = 5 * 60 * 1000

const retryableErrors = [
  'assistant.unavailable',
  'assistant.interrupted',
  'assistant.modal.compactionFailed',
]

/**
 * Account-scoped conversation state shared by the web modal and the native sheet:
 * cloud history, the single cancellable run and the reading context joined to each question.
 * Presentation state (open panel, history view, dictation, diagnostics) stays in the host.
 */
export function useAssistantSession({
  account,
  signedIn,
  liveContext,
  createRequest,
  createCompact,
  onAction,
  onRunStart,
  onThreadSwitch,
  onCurrentThreadDeleted,
  reduceMotion = false,
}: {
  account: string
  signedIn: boolean
  liveContext: ReadingContext | null
  /** Lets a host replace the transport for one run (development diagnostics). */
  createRequest?: (run: { isCurrent: () => boolean }) => ConversationRequest | undefined
  /** Same for the memory compaction that may precede the request. */
  createCompact?: (run: { isCurrent: () => boolean }) => Compactor | undefined
  onAction: (action: AssistantAction) => void
  onRunStart?: () => void
  onThreadSwitch?: () => void
  onCurrentThreadDeleted?: () => void
  /** The reader asked for less motion: answers show as they arrive. */
  reduceMotion?: boolean
}) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [current, setCurrent] = useState<Conversation>(() => newConversation())
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(false),
    [cloudIds, setCloudIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false),
    [revealing, setRevealing] = useState(false),
    [error, setError] = useState(''),
    [retrying, setRetrying] = useState(false),
    [progress, setProgress] = useState(''),
    [progressKey, setProgressKey] = useState('')
  // The context a reader took off their question; another context comes joined again.
  const [detachedKey, setDetachedKey] = useState<string | null>(null)
  // What the server suggests asking after the answer it names.
  const [followUps, setFollowUps] = useState<{ messageId: string; questions: string[] } | null>(
    null
  )
  const active = useRef<AbortController | null>(null)
  // The screen shows the answer at a reading pace while the run goes as fast as it can.
  const [reveal] = useState(() => new AnswerReveal(setCurrent, setRevealing))
  // A run is over once its answer is fully shown.
  const working = busy || revealing
  const receivedInitialIndex = useRef(false)
  // Nothing is sent before the account agreed to share it with third-party AI providers.
  const consent = useAiConsent(signedIn ? account : null)
  // What the reader is looking at goes with each question, like an attachment, unless they
  // took it off (2026-11-08). A context pinned to the conversation goes instead, wherever the
  // reader is (2026-11-15).
  const pinnedContext = current.pinnedContext ?? null
  const context =
    pinnedContext ?? (liveContext && liveContext.key !== detachedKey ? liveContext : null)
  // When the assistant was last closed; in memory only, so that a new start opens a new conversation.
  const closedAt = useRef<number | null>(null)
  useEffect(() => {
    // A visitor has no history: nothing to read, and the assistant only offers to sign in.
    if (!signedIn) {
      setReady(true)
      return
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
          // The app starts on a new conversation; the last one is offered to be resumed.
          if (!receivedInitialIndex.current) {
            receivedInitialIndex.current = true
            return previous
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
        if (active.current || reveal.active) return
        setCurrent(conversation)
        setConversations(previous => [
          conversation,
          ...previous.filter(item => item.id !== conversation.id),
        ])
      },
      () => setStorageError(true)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, current.id, currentIsCloud])
  useEffect(() => () => reveal.stop(), [reveal])
  useEffect(() => reveal.setInstant(reduceMotion), [reveal, reduceMotion])
  const publish = (conversation: Conversation) => {
    setConversations(previous => [conversation, ...previous.filter(c => c.id !== conversation.id)])
    // Saved as soon as it is complete, even while the screen is still revealing it.
    if (conversation.messages.at(-1)?.state !== 'streaming') {
      void saveConversation(account, conversation)
        .then(() => setStorageError(false))
        .catch(() => setStorageError(true))
    }
    reveal.receive(conversation)
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
    if (consent.status !== 'granted') return
    if (!signedIn || getCurrentAuthUser()?.uid !== account) {
      setError('assistant.signIn')
      return
    }
    if (!assistantAvailable) {
      setError('assistant.unavailable')
      return
    }
    try {
      assertConversationCapacity(current)
    } catch {
      setStorageError(true)
      return
    }
    // A new question shows the end of the previous answer at once, and builds on all of it.
    const received = reveal.active ? reveal.latest : null
    const base = received && source === current && received.id === current.id ? received : source
    reveal.flush()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    setFollowUps(null)
    onRunStart?.()
    return runConversation({
      conversation: base,
      question,
      context: readingContext,
      retryOf,
      preferences: captureAssistantPreferences(readingContext?.bibleVersion),
      controller,
      request: createRequest?.({ isCurrent: () => active.current === controller }) || askAssistant,
      compact:
        createCompact?.({ isCurrent: () => active.current === controller }) || compactAssistant,
      isCurrent: () => active.current === controller,
      onUpdate: publish,
      onProgress: key => {
        setProgress(t(key))
        setProgressKey(key)
      },
      onError: key => setError(key),
      onAction,
      onFollowUps: (messageId, questions) => setFollowUps({ messageId, questions }),
    }).finally(() => {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
        setProgress('')
        setProgressKey('')
      }
    })
  }
  const startNewThread = () => {
    if (working) return
    onThreadSwitch?.()
    setCurrent(newConversation())
    setError('')
  }
  /** Opens a new conversation pinned to a context, under a title (a verse meditation's). */
  const startPinnedThread = (pin: ReadingContext, title: string) => {
    if (working) return false
    onThreadSwitch?.()
    setCurrent({ ...newConversation(), title, pinnedContext: pin })
    setError('')
    return true
  }
  const switchToThread = (id: string) => {
    if (working) return
    const conversation = conversations.find(item => item.id === id)
    if (!conversation) return
    onThreadSwitch?.()
    setCurrent(conversation)
    setError('')
  }
  /** The assistant shows: on the conversation left less than five minutes ago, or a new one. */
  const markOpened = () => {
    const closed = closedAt.current
    closedAt.current = null
    if (working || (closed !== null && Date.now() - closed < RESUME_WINDOW_MS)) return
    if (!current.messages.length && !current.summaryMessageCount) return
    startNewThread()
  }
  /** The assistant was closed (not covered by a page it opened). */
  const markClosed = () => {
    closedAt.current = Date.now()
  }
  const setPinnedContext = (pin: ReadingContext | null) => {
    const conversation = { ...current, pinnedContext: pin }
    setCurrent(conversation)
    setConversations(previous =>
      previous.map(item => (item.id === current.id ? { ...item, pinnedContext: pin } : item))
    )
    // A conversation not saved yet carries its pin with its first question.
    if (currentIsCloud)
      void pinConversationContext(account, current.id, pin).catch(() => setStorageError(true))
  }
  const deleteThread = (id: string) => {
    if (working) return
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
  const failedQuestion = current.messages.at(-2)
  const retry =
    !working && retryableErrors.includes(error) && failedQuestion?.role === 'user'
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
  // Asking the last question again writes a new answer in the place of the one given: the same
  // turn in the account, and one more question of the day.
  const lastAnswer = current.messages.at(-1)
  const regenerate =
    !working &&
    !error &&
    failedQuestion?.role === 'user' &&
    lastAnswer?.role === 'assistant' &&
    lastAnswer.state === 'complete'
      ? () =>
          void send(
            failedQuestion.text,
            { ...current, messages: current.messages.slice(0, -2) },
            failedQuestion.context || null,
            failedQuestion
          )
      : undefined
  return {
    conversations,
    current,
    ready,
    storageError,
    setStorageError,
    /** A run is going, or its answer is still being revealed. */
    busy: working,
    /**
     * Questions the reader may ask next, offered under the last answer once it is complete and
     * fully shown. Kept in memory only: a saved conversation reopens without them.
     */
    followUps:
      !working &&
      followUps &&
      current.messages.at(-1)?.id === followUps.messageId &&
      current.messages.at(-1)?.state === 'complete'
        ? followUps.questions
        : [],
    error,
    retrying,
    progress,
    /** The key of the step the run is at (`assistant.steps.reading`…), for Strobi's state. */
    progressKey,
    /** The account's agreement to send its questions to third-party AI providers. */
    consent,
    context,
    /** The context pinned to this conversation, which goes with its questions wherever the reader is. */
    pinnedContext,
    /** Pins the context joined now to the conversation. */
    pinContext: () => {
      if (context && !pinnedContext) setPinnedContext(context)
    },
    /** Unpins it: what the reader is looking at goes with the questions again. */
    unpinContext: () => setPinnedContext(null),
    /** Takes the current context off the next questions, until the reader is somewhere else. */
    detachContext: () => {
      if (pinnedContext) setPinnedContext(null)
      else setDetachedKey(liveContext?.key ?? null)
    },
    attachContext: () => setDetachedKey(null),
    /** The most recent other conversation, offered on a new one to be resumed. */
    resumable:
      current.messages.length || current.summaryMessageCount
        ? null
        : (conversations.find(
            item => item.id !== current.id && (item.summaryMessageCount ?? item.messages.length) > 0
          ) ?? null),
    markOpened,
    markClosed,
    startPinnedThread,
    send,
    /** Stops the run and shows at once everything it received. */
    cancel: () => {
      active.current?.abort()
      reveal.flush()
    },
    retry,
    regenerate,
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
