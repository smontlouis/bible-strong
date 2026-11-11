import type { DebugEntry, DebugSession } from './debug/trace'
import ErrorState from './ErrorState.web'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSelector } from 'react-redux'
import { useAtomValue } from 'jotai'
import { workspaceStoryOpenAtom } from '~features/onboarding/workspace/state'
import { useTranslation } from 'react-i18next'
import { usePathname, useRouter } from 'expo-router'
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
import { premiumStatusAtom } from '~features/premium/premiumStatus'
import { usePremiumVisible } from '~features/premium/premiumVisibility'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { floatingShadow } from '~common/ui/surfaces'
import { resolveFontFamily } from '~themes/styleValues'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { useTheme } from '~themes/ThemeProvider'
import { askAssistant, compactAssistant, connectAssistantDictation } from './client'
import { assistantAccessible, assistantAvailable } from './assistantConfig'
import {
  asksEmailVerification,
  freeQuestionsPaused,
  quotaLine,
  quotaReturn,
  resumeDate,
} from './assistantQuota'
import { contextCaption } from './contextDisplay'
import ContextMarkIcon from './ContextMarkIcon.web'
import FireAuth from '~helpers/FireAuth'
import {
  useAssistantQuota,
  useAssistantQuotaSync,
  useEmailVerificationWatch,
} from './useAssistantQuota'
import { useAssistantSession } from './useAssistantSession'
import { useReadingContext } from './useReadingContext.web'
import './assistant-modal.css'
import { OPEN_ASSISTANT_EVENT } from './returnToAssistant'
import { LiveDictationAdapter } from './dictationAdapter'
import { scriptedAnswersAtom, scriptedRequest } from './playground/scriptedAnswers'
import { captureDictationAudio, dictationSupported } from './dictationAudio.web'
import { convertMessage } from './messageRuntime'
import { AssistantMessage, UserMessage } from './MessageRenderer.web'
import strobiDefinition from './strobi.avatar.json'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { createTabForAssistantAction } from './assistantActions'

const DebugPanel = __DEV__
  ? (require('./debug/DebugPanel.web').default as typeof import('./debug/DebugPanel.web').default)
  : null

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
    | 'stopFilled'
    | 'back'
    | 'trash'
    | 'mic'
    | 'bug'
    | 'pending'
    | 'error'
    | 'down'
    | 'followUp'
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
    stopFilled: 'M7 7h10v10H7z',
    back: 'm14 5-7 7 7 7',
    trash: 'M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 10v7M14 10v7',
    down: 'M12 5v14m7-7-7 7-7-7',
    followUp: 'm15 10 5 5-5 5M4 4v7a4 4 0 0 0 4 4h12',
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
  const openInNewTab = useOpenInNewTab()
  const storyOpen = useAtomValue(workspaceStoryOpenAtom)
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
  // A page asks for the window: Premium's welcome, once the reader may ask without limit.
  useEffect(() => {
    const openWindow = () => changeOpen(true)
    window.addEventListener(OPEN_ASSISTANT_EVENT, openWindow)
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, openWindow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pathname = usePathname()
  const premium = useAtomValue(premiumStatusAtom)
  const premiumVisible = usePremiumVisible()
  // Where it is sold, an account without Premium is offered it at the limit and beside the count.
  const offersPremium = signedIn && premium.kind === 'none' && premiumVisible
  const discoverPremium = () => {
    changeOpen(false)
    router.push({ pathname: '/premium', params: { from: 'assistant' } })
  }
  const loginRef = useRef<HTMLButtonElement | null>(null)
  const scripted = useAtomValue(scriptedAnswersAtom)
  const session = useAssistantSession({
    account,
    signedIn,
    liveContext,
    reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    createRequest: ({ isCurrent }) => {
      if (__DEV__ && scripted) return scriptedRequest(scripted)
      const debug = __DEV__ && debugOpen ? debugSession : null
      if (!debug) return undefined
      return (input, signal, emit) => {
        if (!__DEV__) return askAssistant(input, signal, emit)
        const { askDebugAssistant } =
          require('./debug/client.web') as typeof import('./debug/client.web')
        return askDebugAssistant(input, signal, emit, debug, entry => {
          if (isCurrent() && !signal.aborted && Date.now() < debug.expiresAt)
            setDebugEntries(previous => [...previous, entry].slice(-260))
        })
      }
    },
    createCompact: ({ isCurrent }) => {
      const debug = __DEV__ && debugOpen ? debugSession : null
      if (!debug) return undefined
      return (input, signal) => {
        if (!__DEV__) return compactAssistant(input, signal)
        const { compactDebugAssistant } =
          require('./debug/client.web') as typeof import('./debug/client.web')
        return compactDebugAssistant(input, signal, debug, entry => {
          if (isCurrent() && !signal.aborted && Date.now() < debug.expiresAt)
            setDebugEntries(previous => [...previous, entry].slice(-260))
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
    context,
    detachContext,
    attachContext,
    send,
    followUps,
  } = session
  useAssistantQuotaSync({ active: open, busy, error })
  // What the account may still ask today, and whether it waits for a verified address.
  const quota = useAssistantQuota()
  const quotaText = quotaLine(quota, i18n.language)
  const verification = asksEmailVerification(error, quota) && !busy
  // The free questions are paused until the first of next month: shown as the daily limit is.
  const paused = freeQuestionsPaused(error, quota) && !busy
  const limited = paused || error === 'assistant.limit'
  useEmailVerificationWatch(open && verification)
  const [sendingVerification, setSendingVerification] = useState(false)
  // Opening a conversation shows its last question at the top, not the end of its last
  // answer (2026-11-08). A question asked here rises on its own (`turnAnchor` below).
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const hasMessages = current.messages.length > 0
  useEffect(() => {
    const viewport = viewportRef.current
    if (!open || historyOpen || !hasMessages || busy || !viewport) return
    let stopped = false
    const settle = () => {
      if (stopped) return
      const questions = viewport.querySelectorAll('.bs-assistant-message-user')
      const question = questions[questions.length - 1]
      if (!question) return
      const top =
        question.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top +
        viewport.scrollTop
      viewport.scrollTop = top - parseFloat(getComputedStyle(viewport).paddingTop)
    }
    // Held in place while the cards above load, until the reader scrolls.
    const timers = [0, 150, 400, 900].map(delay => window.setTimeout(settle, delay))
    const stop = () => {
      stopped = true
    }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    events.forEach(name => viewport.addEventListener(name, stop, { passive: true }))
    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
      events.forEach(name => viewport.removeEventListener(name, stop))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyOpen, current.id, hasMessages])
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
        : // The daily quota used up, Strobi sleeps until it starts again.
          limited
          ? 'sleeping'
          : open
            ? 'excited'
            : avatarSleeping
              ? 'sleeping'
              : 'idle'
  const limitReturn = quotaReturn(
    new Date(),
    i18n.language,
    quota?.kind === 'daily' ? quota.limit : undefined
  )
  const dictationActive = ['starting', 'listening', 'stopping'].includes(dictationState)
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
    // The panel floats above the page: the raised level and the one floating shadow.
    '--as-surface': colors.surfaceRaised,
    '--as-ink': colors.default,
    '--as-muted': colors.grey,
    '--as-accent': colors.primary,
    '--as-link': colors.link,
    '--as-soft': colors.lightGrey,
    '--as-border': colors.border,
    '--as-line': colors.separator,
    '--as-floating-shadow': floatingShadow.boxShadow,
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
          // Strobi stays out of the Premium page and of the onboarding's story.
          (open || (pathname !== '/premium' && !storyOpen)) &&
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
              <ThreadPrimitive.Viewport
                ref={viewportRef}
                className="bs-assistant-viewport"
                // A question asked rises to the top and its answer is written below it; the
                // page never follows the text, so the reader keeps their place.
                turnAnchor="top"
                scrollToBottomOnInitialize={false}
                scrollToBottomOnThreadSwitch={false}
              >
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
                {verification ? (
                  <div className="bs-assistant-verify" role="alert">
                    <p className="bs-assistant-verify-title">{t('assistant.verifyCard.title')}</p>
                    <p>
                      {quota?.kind === 'verify_email'
                        ? t('assistant.verifyCard.detail', { count: quota.limit })
                        : t('assistant.verifyEmail')}
                    </p>
                    <button
                      type="button"
                      disabled={sendingVerification}
                      onClick={() => {
                        setSendingVerification(true)
                        void FireAuth.sendEmailVerification().finally(() =>
                          setSendingVerification(false)
                        )
                      }}
                    >
                      {t('assistant.verifyCard.resend')}
                    </button>
                  </div>
                ) : (
                  (error || retrying || paused) &&
                  // A refusal for the address says nothing more once the address is verified.
                  error !== 'assistant.verifyEmail' &&
                  (paused || error !== 'assistant.freePaused') && (
                    <ErrorState
                      retrying={retrying}
                      title={t(
                        limited
                          ? 'assistant.limitCard.title'
                          : error === 'assistant.signIn'
                            ? 'assistant.errors.signInTitle'
                            : 'assistant.errors.title'
                      )}
                      detail={
                        paused
                          ? quota?.kind === 'paused'
                            ? t('assistant.limitCard.paused', {
                                date: resumeDate(quota.resumesAt, i18n.language),
                              })
                            : t('assistant.freePausedUndated')
                          : error === 'assistant.limit'
                            ? t(limitReturn.key, {
                                time: limitReturn.time,
                                count: limitReturn.count,
                              })
                            : t(error ?? '')
                      }
                      onRetry={limited ? undefined : session.retry}
                    />
                  )
                )}
                {limited && offersPremium && (
                  <div className="bs-assistant-verify">
                    <p>{t('assistant.limitCard.premiumHint')}</p>
                    <button type="button" onClick={discoverPremium}>
                      {t('assistant.limitCard.premium')}
                    </button>
                  </div>
                )}
                {!!followUps.length && !error && (
                  // A question picked is asked at once, like the starting points.
                  <div
                    className="bs-assistant-follow-ups"
                    role="group"
                    aria-labelledby="bs-follow-ups"
                  >
                    <p id="bs-follow-ups">{t('assistant.modal.followUps')}</p>
                    {followUps.map(question => (
                      <ThreadPrimitive.Suggestion
                        key={question}
                        prompt={question}
                        send
                        disabled={busy || !ready}
                        title={t('assistant.modal.followUpHint')}
                      >
                        <Icon name="followUp" />
                        <span>{question}</span>
                      </ThreadPrimitive.Suggestion>
                    ))}
                  </div>
                )}
                <ThreadPrimitive.ViewportFooter className="bs-assistant-compose-area">
                  {hasMessages && (
                    <ThreadPrimitive.ScrollToBottom
                      className="bs-assistant-to-end"
                      aria-label={t('assistant.modal.toEnd')}
                      title={t('assistant.modal.toEnd')}
                    >
                      <Icon name="down" />
                    </ThreadPrimitive.ScrollToBottom>
                  )}
                  {signedIn && quotaText && (
                    // Sending stays open at zero: the service checks Premium before it refuses.
                    <p className="bs-assistant-quota" aria-live="polite">
                      {quotaText.kind === 'remaining'
                        ? t('assistant.quota.remaining', { count: quotaText.count })
                        : quotaText.kind === 'paused'
                          ? t('assistant.quota.paused', { date: quotaText.date })
                          : t('assistant.quota.none', { time: quotaText.time })}
                      {offersPremium && (
                        <button
                          type="button"
                          className="bs-assistant-quota-premium"
                          onClick={discoverPremium}
                        >
                          {t('assistant.quota.premium')}
                        </button>
                      )}
                    </p>
                  )}
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
                            <ContextMarkIcon context={context} />
                            <span
                              className="bs-assistant-context-label"
                              title={contextCaption(context)}
                            >
                              {contextCaption(context)}
                            </span>
                            <button
                              type="button"
                              className="bs-assistant-chip-remove"
                              aria-label={t('assistant.modal.detachContext', {
                                context: contextCaption(context),
                              })}
                              title={t('assistant.modal.detachContext', {
                                context: contextCaption(context),
                              })}
                              onClick={detachContext}
                            >
                              <Icon name="close" />
                            </button>
                          </div>
                        ) : liveContext ? (
                          <button
                            type="button"
                            className="bs-assistant-context-restore"
                            title={t('assistant.modal.attachContext', {
                              context: contextCaption(liveContext),
                            })}
                            onClick={attachContext}
                          >
                            <Icon name="plus" />
                            <span className="bs-assistant-context-label">
                              {contextCaption(liveContext)}
                            </span>
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
                              <Icon name="stopFilled" />
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
