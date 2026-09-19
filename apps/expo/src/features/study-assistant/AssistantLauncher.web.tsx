import type { DebugEntry, DebugSession } from './debug/trace'
import ErrorState from './ErrorState.web'
import { runConversation } from './conversationRun'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import {
  AssistantModalPrimitive as Modal,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
} from '@assistant-ui/react'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { useTheme } from '~themes/ThemeProvider'
import {
  askAssistant,
  compactAssistant,
  captureAssistantPreferences,
  connectAssistantDictation,
} from './client'
import { assistantAccessible, assistantAvailable } from './assistantConfig'
import {
  loadConversations,
  loadSelectedConversation,
  saveSelectedConversation,
  saveConversations,
  newConversation,
  type Conversation,
  type ReadingContext,
} from './conversations'
import { useReadingContext } from './useReadingContext.web'
import './assistant-modal.css'
import { LiveDictationAdapter } from './dictationAdapter'
import { captureDictationAudio, dictationSupported } from './dictationAudio.web'
import { convertMessage } from './messageRuntime'
import { AssistantMessage, UserMessage } from './MessageRenderer.web'

const DebugPanel = __DEV__
  ? (require('./debug/DebugPanel.web').default as typeof import('./debug/DebugPanel.web').default)
  : null

const contextCaption = (value: ReadingContext) =>
  ['passage', 'word'].includes(value.kind) ? value.detail : value.label

function Avatar() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M9 14c6-2 10-1 15 3 5-4 9-5 15-3v23c-6-2-10-1-15 2-5-3-9-4-15-2V14Z"
        fill="currentColor"
        opacity=".18"
      />
      <path
        d="M9 14c6-2 10-1 15 3 5-4 9-5 15-3v23c-6-2-10-1-15 2-5-3-9-4-15-2V14Zm15 3v22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M31 6v6m-3-3h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="25" r="1.5" fill="currentColor" />
      <circle cx="31" cy="25" r="1.5" fill="currentColor" />
    </svg>
  )
}
function Icon({
  name,
}: {
  name:
    | 'close'
    | 'plus'
    | 'history'
    | 'send'
    | 'stop'
    | 'stopFilled'
    | 'pin'
    | 'back'
    | 'trash'
    | 'collapse'
    | 'mic'
    | 'bug'
    | 'pending'
    | 'error'
}) {
  const paths = {
    error: 'M12 8v5m0 3.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    pending: 'M21 12a9 9 0 1 1-2.64-6.36',
    bug: 'm8 2 2 2m6-2-2 2M9 7V6a3 3 0 0 1 6 0v1M8 7h8a1 1 0 0 1 1 1v8a5 5 0 0 1-10 0V8a1 1 0 0 1 1-1ZM12 10v11M3 12h4m10 0h4M3 6l4 3m10 0 4-3M3 20l4-3m10 0 4 3',
    mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
    collapse: 'm6 9 6 6 6-6',
    close: 'm6 6 12 12M6 18 18 6',
    plus: 'M12 5v14M5 12h14',
    history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
    send: 'm5 12 7-7 7 7M12 5v14',
    stop: 'M7 7h10v10H7z',
    stopFilled: 'M7 7h10v10H7z',
    pin: 'm9 3 6 0-1 6 4 4v2h-5v6h-2v-6H6v-2l4-4-1-6Z',
    back: 'm14 5-7 7 7 7',
    trash: 'M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 10v7M14 10v7',
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={name === 'stopFilled' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
export default function AssistantLauncher() {
  const { id } = useSelector(selectUserLoginInfo)
  if (!assistantAccessible(id)) return null
  return <AccountAssistant key={id || 'guest'} account={id || 'guest'} signedIn={Boolean(id)} />
}
function AccountAssistant({ account, signedIn }: { account: string; signedIn: boolean }) {
  const { t } = useTranslation(),
    router = useRouter(),
    { colors, fontFamily } = useTheme()
  const liveContext = useReadingContext()
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugSession, setDebugSession] = useState<DebugSession | null>(null)
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([])
  useEffect(() => {
    if (!debugSession) return
    const clear = () => {
      setDebugSession(null)
      setDebugEntries([])
    }
    const timer = setTimeout(clear, Math.max(0, debugSession.expiresAt - Date.now()))
    window.addEventListener('pagehide', clear)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', clear)
    }
  }, [debugSession])
  const [open, setOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [current, setCurrent] = useState<Conversation>(() => newConversation())
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(false),
    [writable, setWritable] = useState(true)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [retrying, setRetrying] = useState(false),
    [progress, setProgress] = useState('')
  const [pinned, setPinned] = useState<ReadingContext | null>(null),
    [excluded, setExcluded] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [dictationState, setDictationState] = useState<
    'idle' | 'starting' | 'listening' | 'stopping' | 'error'
  >('idle')
  const [dictation] = useState(
    () =>
      new LiveDictationAdapter({
        connect: connectAssistantDictation,
        capture: captureDictationAudio,
        onError: key => {
          toast.error(i18n.t(key))
          setDictationState('error')
        },
        onState: setDictationState,
      })
  )
  useEffect(() => {
    const cancel = () => dictation.cancel()
    window.addEventListener('pagehide', cancel)
    return () => {
      window.removeEventListener('pagehide', cancel)
      cancel()
    }
  }, [dictation])
  useEffect(() => {
    if (!open || historyOpen) dictation.cancel()
  }, [open, historyOpen, dictation])
  const loginRef = useRef<HTMLButtonElement | null>(null)
  const active = useRef<AbortController | null>(null),
    latest = useRef(conversations)
  const context = pinned || (liveContext?.key !== excluded ? liveContext : null)
  const dictationActive = ['starting', 'listening', 'stopping'].includes(dictationState)
  useEffect(() => {
    latest.current = conversations
  }, [conversations])
  useEffect(() => {
    try {
      const saved = loadConversations(localStorage, account)
      setConversations(saved)
      const selected = loadSelectedConversation(localStorage, account, saved)
      if (selected) setCurrent(selected)
    } catch {
      setStorageError(true)
      setWritable(false)
    }
    setReady(true)
    return () => {
      active.current?.abort()
      active.current = null
    }
  }, [account])
  useEffect(() => {
    if (!ready || !writable) return
    const save = () => {
      try {
        saveConversations(localStorage, account, latest.current)
        setStorageError(false)
      } catch {
        setStorageError(true)
      }
    }
    const timer = setTimeout(save, 500)
    window.addEventListener('pagehide', save)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', save)
    }
  }, [account, conversations, ready, writable])
  const hasMessages = current.messages.length > 0
  useEffect(() => {
    if (!ready || !writable) return
    try {
      saveSelectedConversation(localStorage, account, hasMessages ? current.id : null)
    } catch {
      setStorageError(true)
    }
  }, [account, current.id, hasMessages, ready, writable])
  const publish = (conversation: Conversation) => {
    setCurrent(conversation)
    setConversations(previous => [conversation, ...previous.filter(c => c.id !== conversation.id)])
  }
  const send = (text: string, source = current, readingContext = context) => {
    const question = text.trim()
    if (!question || active.current || !ready) return
    if (!signedIn || getCurrentAuthUser()?.uid !== account) {
      setError('assistant.signIn')
      return
    }
    if (!assistantAvailable) {
      setError('assistant.unavailable')
      return
    }
    if (
      current.messages.length >= 298 ||
      (!current.messages.length && conversations.length >= 50)
    ) {
      setStorageError(true)
      return
    }
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    setHistoryOpen(false)
    if (__DEV__ && debugOpen) setDebugEntries([])
    const session = __DEV__ && debugOpen ? debugSession : null
    return runConversation({
      conversation: source,
      question,
      context: readingContext,
      preferences: captureAssistantPreferences(readingContext?.bibleVersion),
      controller,
      request: session
        ? (input, signal, emit) => {
            if (!__DEV__) return askAssistant(input, signal, emit)
            const { askDebugAssistant } =
              require('./debug/client.web') as typeof import('./debug/client.web')
            return askDebugAssistant(input, signal, emit, session, entry => {
              if (
                active.current === controller &&
                !signal.aborted &&
                Date.now() < session.expiresAt
              )
                setDebugEntries(previous => [...previous, entry].slice(-251))
            })
          }
        : askAssistant,
      compact: compactAssistant,
      isCurrent: () => active.current === controller,
      onUpdate: publish,
      onProgress: key => setProgress(t(key)),
      onError: key => setError(key),
    }).finally(() => {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
        setProgress('')
      }
    })
  }
  const onNew = async (message: AppendMessage) => {
    await send(message.content.flatMap(p => (p.type === 'text' ? [p.text] : [])).join('\n'))
  }
  const startNewThread = () => {
    if (busy) return
    dictation.cancel()
    setDebugEntries([])
    setCurrent(newConversation())
    setHistoryOpen(false)
    setError('')
  }
  const switchToThread = (id: string) => {
    if (busy) return
    const conversation = conversations.find(item => item.id === id)
    if (!conversation) return
    dictation.cancel()
    setDebugEntries([])
    setCurrent(conversation)
    setHistoryOpen(false)
    setError('')
  }
  const deleteThread = (id: string) => {
    if (current.id === id) dictation.cancel()
    const next = conversations.filter(c => c.id !== id)
    setConversations(next)
    if (current.id === id) setCurrent(newConversation())
    try {
      saveConversations(localStorage, account, next)
    } catch {
      setStorageError(true)
    }
  }
  const renameThread = (id: string, title: string) => {
    setConversations(previous =>
      previous.map(conversation =>
        conversation.id === id ? { ...conversation, title, updatedAt: Date.now() } : conversation
      )
    )
    if (current.id === id) setCurrent(previous => ({ ...previous, title, updatedAt: Date.now() }))
  }
  const runtime = useExternalStoreRuntime({
    adapters: {
      dictation,
      threadList: {
        threadId: current.id,
        threads: conversations.map(conversation => ({
          id: conversation.id,
          status: 'regular' as const,
          title: conversation.title,
          custom: {
            updatedAt: conversation.updatedAt,
            messageCount: conversation.messages.length,
          },
        })),
        onSwitchToNewThread: startNewThread,
        onSwitchToThread: switchToThread,
        onRename: renameThread,
        onDelete: deleteThread,
      },
    },
    messages: current.messages,
    convertMessage,
    isRunning: busy,
    onNew,
    onCancel: async () => {
      active.current?.abort()
    },
  })
  const vars = {
    fontFamily: resolveFontFamily(fontFamily.text),
    '--as-surface': colors.reverse,
    '--as-ink': colors.default,
    '--as-muted': colors.grey,
    '--as-accent': colors.primary,
    '--as-soft': colors.lightGrey,
    '--as-border': colors.border,
  } as CSSProperties
  const shortcuts =
    context &&
    ['plan', 'meditation', 'entity', 'person', 'place', 'timeline'].includes(context.kind)
      ? ['editorialExplain', 'editorialReferences', 'editorialReflect']
      : context?.kind === 'word'
        ? ['word', 'usage']
        : context?.kind === 'commentary'
          ? ['commentaryExplain', 'commentaryDistinguish']
          : context?.kind === 'dictionary'
            ? ['articleExplain', 'articleReferences']
            : context?.kind === 'nave'
              ? ['topicExplain', 'topicPassages']
              : context
                ? ['explain', 'context', 'question']
                : ['start', 'theme']
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Modal.Root
        open={open}
        onOpenChange={value => {
          if (!value) dictation.cancel()
          setOpen(value)
        }}
        unstable_openOnRunStart={false}
      >
        {ready &&
          createPortal(
            <Modal.Anchor className="bs-assistant-anchor" style={vars}>
              {!open && context && <span className="bs-assistant-hint">{context.label}</span>}
              <Modal.Trigger
                className="bs-assistant-avatar"
                aria-label={t(open ? 'assistant.modal.close' : 'assistant.modal.open')}
              >
                {open ? <Icon name="collapse" /> : <Avatar />}
                {!open && <span className="bs-assistant-badge">IA</span>}
              </Modal.Trigger>
            </Modal.Anchor>,
            document.body
          )}
        <Modal.Content
          side="top"
          align="end"
          sideOffset={14}
          collisionPadding={12}
          className={`bs-assistant-modal ${__DEV__ && debugOpen ? 'bs-assistant-debug-open' : ''}`}
          style={vars}
          aria-label={t('assistant.title')}
          onOpenAutoFocus={event => {
            event.preventDefault()
            ;(inputRef.current || loginRef.current)?.focus()
          }}
        >
          <header className="bs-assistant-header">
            <div className="bs-assistant-heading">
              <strong title={current.title || t('assistant.modal.newChat')}>
                {current.title || t('assistant.modal.newChat')}
              </strong>
            </div>
            {__DEV__ && signedIn && (
              <button
                type="button"
                className="bs-assistant-icon"
                aria-label={t('assistant.debug.title')}
                aria-pressed={debugOpen}
                disabled={busy}
                title={t('assistant.debug.title')}
                onClick={() => {
                  setDebugOpen(!debugOpen)
                  setDebugSession(null)
                  setDebugEntries([])
                }}
              >
                <Icon name="bug" />
              </button>
            )}
            <button
              type="button"
              className="bs-assistant-icon"
              title={t('assistant.modal.history')}
              aria-label={t('assistant.modal.history')}
              aria-pressed={historyOpen}
              disabled={busy}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <Icon name="history" />
            </button>
            <ThreadListPrimitive.New asChild>
              <button
                type="button"
                className="bs-assistant-icon"
                title={t('assistant.new')}
                aria-label={t('assistant.new')}
                disabled={busy}
              >
                <Icon name="plus" />
              </button>
            </ThreadListPrimitive.New>
          </header>
          {historyOpen ? (
            <section className="bs-assistant-history">
              <button className="bs-assistant-back" onClick={() => setHistoryOpen(false)}>
                <Icon name="back" />
                {t('assistant.modal.back')}
              </button>
              <h2>{t('assistant.modal.history')}</h2>
              <p>{t('assistant.modal.local')}</p>
              {!conversations.length && (
                <p className="bs-assistant-empty-history">{t('assistant.modal.noHistory')}</p>
              )}
              <ThreadListPrimitive.Root>
                <ThreadListPrimitive.Items>
                  {({ threadListItem }) => {
                    const conversation = conversations.find(item => item.id === threadListItem.id)
                    if (!conversation) return null
                    return (
                      <ThreadListItemPrimitive.Root className="bs-assistant-history-row">
                        <ThreadListItemPrimitive.Trigger asChild>
                          <button disabled={busy}>
                            <strong>{conversation.title}</strong>
                            <span>
                              {new Date(conversation.updatedAt).toLocaleDateString()} ·{' '}
                              {Math.floor(conversation.messages.length / 2)}{' '}
                              {t(
                                conversation.messages.length === 2
                                  ? 'assistant.modal.exchange'
                                  : 'assistant.modal.exchanges'
                              )}
                            </span>
                          </button>
                        </ThreadListItemPrimitive.Trigger>
                        <ThreadListItemPrimitive.Delete asChild>
                          <button
                            className="bs-assistant-icon"
                            disabled={busy}
                            aria-label={`${t('assistant.modal.delete')} ${conversation.title}`}
                          >
                            <Icon name="trash" />
                          </button>
                        </ThreadListItemPrimitive.Delete>
                      </ThreadListItemPrimitive.Root>
                    )
                  }}
                </ThreadListPrimitive.Items>
              </ThreadListPrimitive.Root>
            </section>
          ) : (
            <ThreadPrimitive.Root
              className={`bs-assistant-thread ${!current.messages.length ? 'bs-assistant-thread-empty' : ''}`}
            >
              <ThreadPrimitive.Viewport className="bs-assistant-viewport">
                {!current.messages.length && (
                  <div className="bs-assistant-welcome">
                    <h2>{t('assistant.modal.welcome')}</h2>
                  </div>
                )}
                <ThreadPrimitive.Messages>
                  {({ message }) =>
                    message.role === 'user' ? (
                      <UserMessage />
                    ) : (
                      <AssistantMessage
                        busy={busy}
                        error={error}
                        lastMessageId={current.messages.at(-1)?.id}
                      />
                    )
                  }
                </ThreadPrimitive.Messages>
                {progress && (
                  <div className="bs-assistant-progress" role="status">
                    <span />
                    {progress}
                  </div>
                )}
                {(error || retrying) && (
                  <ErrorState
                    retrying={retrying}
                    title={t(
                      error === 'assistant.limit'
                        ? 'assistant.errors.limitTitle'
                        : error === 'assistant.signIn'
                          ? 'assistant.errors.signInTitle'
                          : 'assistant.errors.title'
                    )}
                    detail={t(error === 'assistant.limit' ? 'assistant.errors.limitDetail' : error)}
                    onRetry={
                      !busy &&
                      [
                        'assistant.unavailable',
                        'assistant.interrupted',
                        'assistant.modal.compactionFailed',
                      ].includes(error) &&
                      current.messages.at(-2)?.role === 'user'
                        ? () => {
                            const question = current.messages.at(-2)!
                            setRetrying(true)
                            void Promise.resolve(
                              send(
                                question.text,
                                { ...current, messages: current.messages.slice(0, -2) },
                                question.context || null
                              )
                            ).finally(() => setRetrying(false))
                          }
                        : undefined
                    }
                  />
                )}
                <ThreadPrimitive.ViewportFooter className="bs-assistant-compose-area">
                  {signedIn ? (
                    <ComposerPrimitive.Root className="bs-assistant-composer">
                      <ComposerPrimitive.Input
                        submitMode={dictationActive ? 'none' : 'enter'}
                        ref={inputRef}
                        className="bs-assistant-input"
                        placeholder={t('assistant.modal.placeholder')}
                        aria-label={t('assistant.modal.placeholder')}
                        maxLength={4000}
                        disabled={!ready || !assistantAvailable}
                      />
                      <div className="bs-assistant-composer-toolbar">
                        {context ? (
                          <div className="bs-assistant-context-chip">
                            <button
                              type="button"
                              className="bs-assistant-context-label"
                              aria-pressed={Boolean(pinned)}
                              title={t(pinned ? 'assistant.modal.unpin' : 'assistant.modal.pin')}
                              onClick={() => setPinned(pinned ? null : { ...context })}
                            >
                              {pinned && <Icon name="pin" />}
                              <span>{contextCaption(context)}</span>
                            </button>
                            <button
                              type="button"
                              className="bs-assistant-chip-remove"
                              aria-label={t('assistant.modal.removeContext')}
                              onClick={() => {
                                setPinned(null)
                                setExcluded(liveContext?.key || null)
                              }}
                            >
                              <Icon name="close" />
                            </button>
                          </div>
                        ) : liveContext ? (
                          <button
                            type="button"
                            className="bs-assistant-context-restore"
                            onClick={() => setExcluded(null)}
                          >
                            {t('assistant.modal.useContext')}
                          </button>
                        ) : (
                          <span />
                        )}
                        <div className="bs-assistant-compose-actions">
                          {dictationSupported() &&
                            !busy &&
                            (dictationState === 'idle' || dictationState === 'error' ? (
                              <ComposerPrimitive.Dictate
                                onClick={() =>
                                  dictation.setTextLength(inputRef.current?.value.length || 0)
                                }
                                className={`bs-assistant-dictate${dictationState === 'error' ? ' bs-assistant-dictate-error' : ''}`}
                                aria-label={
                                  dictationState === 'error'
                                    ? `${t('assistant.dictation.error')} ${t('assistant.dictation.start')}`
                                    : t('assistant.dictation.start')
                                }
                                title={
                                  dictationState === 'error'
                                    ? t('assistant.dictation.error')
                                    : t('assistant.dictation.start')
                                }
                                disabled={!ready || !assistantAvailable}
                              >
                                <Icon name={dictationState === 'error' ? 'error' : 'mic'} />
                              </ComposerPrimitive.Dictate>
                            ) : (
                              <ComposerPrimitive.StopDictation
                                className={`bs-assistant-dictate${dictationState === 'listening' ? ' bs-assistant-dictate-active' : ' bs-assistant-dictate-pending'}`}
                                aria-label={
                                  dictationState === 'starting'
                                    ? t('assistant.dictation.starting')
                                    : dictationState === 'stopping'
                                      ? t('assistant.dictation.stopping')
                                      : t('assistant.dictation.stop')
                                }
                                title={
                                  dictationState === 'starting'
                                    ? t('assistant.dictation.starting')
                                    : dictationState === 'stopping'
                                      ? t('assistant.dictation.stopping')
                                      : t('assistant.dictation.stop')
                                }
                                disabled={dictationState !== 'listening'}
                              >
                                <span
                                  className={
                                    dictationState === 'listening'
                                      ? undefined
                                      : 'bs-assistant-dictate-spinner'
                                  }
                                >
                                  <Icon
                                    name={dictationState === 'listening' ? 'stopFilled' : 'pending'}
                                  />
                                </span>
                              </ComposerPrimitive.StopDictation>
                            ))}
                          {busy ? (
                            <ComposerPrimitive.Cancel
                              className="bs-assistant-send"
                              aria-label={t('assistant.stop')}
                            >
                              <Icon name="stop" />
                            </ComposerPrimitive.Cancel>
                          ) : (
                            <ComposerPrimitive.Send
                              className="bs-assistant-send"
                              aria-label={t('assistant.send')}
                              disabled={!ready || !assistantAvailable || dictationActive}
                            >
                              <Icon name="send" />
                            </ComposerPrimitive.Send>
                          )}
                        </div>
                      </div>
                    </ComposerPrimitive.Root>
                  ) : (
                    <button
                      ref={loginRef}
                      className="bs-assistant-login"
                      onClick={() => {
                        setOpen(false)
                        router.push('/login')
                      }}
                    >
                      {t('assistant.modal.login')}
                    </button>
                  )}
                  {!current.messages.length && (
                    <div className="bs-assistant-suggestions">
                      {shortcuts.map(key => (
                        <ThreadPrimitive.Suggestion
                          key={key}
                          prompt={t(`assistant.modal.prompt.${key}`)}
                          send
                          disabled={busy || !ready}
                        >
                          <span aria-hidden="true">›</span>
                          <span>{t(`assistant.modal.action.${key}`)}</span>
                        </ThreadPrimitive.Suggestion>
                      ))}
                    </div>
                  )}
                </ThreadPrimitive.ViewportFooter>
              </ThreadPrimitive.Viewport>
            </ThreadPrimitive.Root>
          )}
          {__DEV__ && debugOpen && DebugPanel && (
            <DebugPanel
              session={debugSession}
              entries={debugEntries}
              busy={busy}
              onSession={setDebugSession}
              onClear={() => setDebugEntries([])}
            />
          )}
          {storageError && (
            <ErrorState
              title={t('assistant.errors.storageTitle')}
              detail={t('assistant.modal.storageError')}
            />
          )}
        </Modal.Content>
      </Modal.Root>
    </AssistantRuntimeProvider>
  )
}
