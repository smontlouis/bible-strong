import type { DebugEntry, DebugSession } from './debug/trace'
import ErrorState from './ErrorState.web'
import { createPortal } from 'react-dom'
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
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
import { createAvatar } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { useTheme } from '~themes/ThemeProvider'
import { askAssistant, connectAssistantDictation } from './client'
import { assistantAccessible, assistantAvailable } from './assistantConfig'
import { followReadingPreferenceKey, type ReadingContext } from './conversations'
import { useAssistantSession } from './useAssistantSession'
import { useReadingContext } from './useReadingContext.web'
import './assistant-modal.css'
import { LiveDictationAdapter } from './dictationAdapter'
import { captureDictationAudio, dictationSupported } from './dictationAudio.web'
import { convertMessage } from './messageRuntime'
import { AssistantMessage, UserMessage } from './MessageRenderer.web'
import strobiDefinition from './strobi.avatar.json'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { createTabForAssistantAction } from './assistantActions'

const DebugPanel = __DEV__
  ? (require('./debug/DebugPanel.web').default as typeof import('./debug/DebugPanel.web').default)
  : null

const contextCaption = (value: ReadingContext) =>
  ['passage', 'word'].includes(value.kind) ? value.detail : value.label

const StrobiAvatar = createAvatar(strobiDefinition)
type StrobiAnimation = 'idle' | 'sleeping' | 'excited' | 'thinking' | 'listening'

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
    | 'pinFilled'
    | 'back'
    | 'trash'
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
    close: 'm6 6 12 12M6 18 18 6',
    plus: 'M12 5v14M5 12h14',
    history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
    send: 'm5 12 7-7 7 7M12 5v14',
    stop: 'M7 7h10v10H7z',
    stopFilled: 'M7 7h10v10H7z',
    pin: 'm9 3 6 0-1 6 4 4v2h-5v6h-2v-6H6v-2l4-4-1-6Z',
    pinFilled: 'm9 3 6 0-1 6 4 4v2h-5v6h-2v-6H6v-2l4-4-1-6Z',
    back: 'm14 5-7 7 7 7',
    trash: 'M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 10v7M14 10v7',
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={name === 'stopFilled' || name === 'pinFilled' ? 'currentColor' : 'none'}
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
  const openInNewTab = useOpenInNewTab()
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
  const [avatarSleeping, setAvatarSleeping] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
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
  const changeOpen = (value: boolean) => {
    setOpen(value)
    setAvatarSleeping(false)
    if (!value) dictation.cancel()
  }
  const loginRef = useRef<HTMLButtonElement | null>(null)
  const session = useAssistantSession({
    account,
    signedIn,
    liveContext,
    preferenceStorage: () => localStorage,
    createRequest: ({ isCurrent }) => {
      const debug = __DEV__ && debugOpen ? debugSession : null
      if (!debug) return undefined
      return (input, signal, emit) => {
        if (!__DEV__) return askAssistant(input, signal, emit)
        const { askDebugAssistant } =
          require('./debug/client.web') as typeof import('./debug/client.web')
        return askDebugAssistant(input, signal, emit, debug, entry => {
          if (isCurrent() && !signal.aborted && Date.now() < debug.expiresAt)
            setDebugEntries(previous => [...previous, entry].slice(-251))
        })
      }
    },
    onAction: action => {
      const tab = createTabForAssistantAction(action)
      if (!tab) {
        toast.error(t('assistant.unavailable'))
        return
      }
      openInNewTab(tab, { autoRedirect: true })
      changeOpen(false)
    },
    onRunStart: () => {
      setHistoryOpen(false)
      if (__DEV__ && debugOpen) setDebugEntries([])
    },
    onThreadSwitch: () => {
      dictation.cancel()
      setDebugEntries([])
      setHistoryOpen(false)
    },
    onCurrentThreadDeleted: () => dictation.cancel(),
  })
  const {
    conversations,
    current,
    ready,
    storageError,
    busy,
    error,
    retrying,
    progress,
    pinned,
    setPinned,
    context,
    send,
    changeFollowReading,
  } = session
  useEffect(() => {
    if (open || !ready) return
    const sleepTimer = window.setTimeout(() => setAvatarSleeping(true), 10_000)
    return () => window.clearTimeout(sleepTimer)
  }, [open, ready])
  const avatarAnimation: StrobiAnimation =
    busy && open
      ? 'thinking'
      : avatarHovered
        ? 'listening'
        : open
          ? 'excited'
          : avatarSleeping
            ? 'sleeping'
            : 'idle'
  const dictationActive = ['starting', 'listening', 'stopping'].includes(dictationState)
  const syncFollowReading = useEffectEvent((enabled: boolean) => changeFollowReading(enabled))
  useEffect(() => {
    const key = followReadingPreferenceKey(account)
    const sync = (event: StorageEvent) => {
      if (event.key !== key) return
      syncFollowReading(event.newValue === 'true')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [account])
  const onNew = async (message: AppendMessage) => {
    await send(message.content.flatMap(p => (p.type === 'text' ? [p.text] : [])).join('\n'))
  }
  const runtime = useExternalStoreRuntime({
    adapters: {
      dictation,
      threadList: session.threadList,
    },
    messages: current.messages,
    convertMessage,
    isRunning: busy,
    onNew,
    onCancel: async () => {
      session.cancel()
    },
  })
  const vars = {
    fontFamily: resolveFontFamily(fontFamily.text),
    '--as-surface': colors.reverse,
    '--as-ink': colors.default,
    '--as-muted': colors.grey,
    '--as-accent': colors.primary,
    '--as-link': colors.link,
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
          changeOpen(value)
        }}
        unstable_openOnRunStart={false}
      >
        {ready &&
          createPortal(
            <Modal.Anchor className="bs-assistant-anchor" style={vars}>
              <Modal.Trigger
                className="bs-assistant-avatar"
                aria-label={t(open ? 'assistant.modal.close' : 'assistant.modal.open')}
                onMouseEnter={() => setAvatarHovered(true)}
                onMouseLeave={() => setAvatarHovered(false)}
              >
                <StrobiAvatar
                  animation={avatarAnimation}
                  size="var(--bs-assistant-avatar-size)"
                  ariaLabel="Strobi"
                />
              </Modal.Trigger>
            </Modal.Anchor>,
            document.body
          )}
        <Modal.Content
          side="top"
          align="end"
          sideOffset={50}
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
            <button
              type="button"
              className="bs-assistant-heading"
              aria-label={t('assistant.modal.close')}
              onClick={() => {
                dictation.cancel()
                changeOpen(false)
              }}
            >
              <strong title={current.title || t('assistant.modal.newChat')}>
                {current.title || t('assistant.modal.newChat')}
              </strong>
            </button>
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
                    onRetry={session.retry}
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
                          <div
                            className={`bs-assistant-context-chip${pinned ? ' bs-assistant-context-chip-pinned' : ''}`}
                            data-pinned={pinned ? 'true' : 'false'}
                          >
                            <button
                              type="button"
                              className="bs-assistant-chip-pin"
                              aria-pressed={Boolean(pinned)}
                              aria-label={t(
                                pinned ? 'assistant.modal.unpin' : 'assistant.modal.pin'
                              )}
                              title={t(pinned ? 'assistant.modal.unpin' : 'assistant.modal.pin')}
                              onClick={() => setPinned(pinned ? null : { ...context })}
                            >
                              <Icon name={pinned ? 'pinFilled' : 'pin'} />
                            </button>
                            <span
                              className="bs-assistant-context-label"
                              title={contextCaption(context)}
                            >
                              {contextCaption(context)}
                            </span>
                            <button
                              type="button"
                              className="bs-assistant-chip-remove"
                              aria-label={t('assistant.modal.removeContext')}
                              onClick={() => changeFollowReading(false)}
                            >
                              <Icon name="close" />
                            </button>
                          </div>
                        ) : liveContext ? (
                          <button
                            type="button"
                            className="bs-assistant-context-restore"
                            aria-pressed={false}
                            onClick={() => changeFollowReading(true)}
                          >
                            {t('assistant.modal.followReading')}
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
                        changeOpen(false)
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
