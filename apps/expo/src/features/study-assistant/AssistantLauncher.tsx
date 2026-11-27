import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { FullWindowOverlay } from 'react-native-screens'
import { bibleAudioPlayerOpenAtom } from '~features/bible-audio/atoms'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useAtomValue, useSetAtom } from 'jotai'
import { usePathname, useRouter } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import { useExternalStoreRuntime, type AppendMessage } from '@assistant-ui/react-native'
import type { StudySource } from '@bible-strong/ai-contract/contract'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { premiumStatusAtom } from '~features/premium/premiumStatus'
import { createTabForAssistantAction } from './assistantActions'
import { assistantLaunchAtom, LAUNCH_TTL_MS, type AssistantLaunch } from './assistantLaunch'
import { useAssistantAccessible } from './assistantConfig'
import { nextQuotaReset } from './assistantQuota'
import AssistantLauncherButton from './AssistantLauncherButton'
import {
  ASSISTANT_PATH,
  assistantPageAtom,
  type AssistantSheet,
  type DictationState,
} from './assistantSheetContext'
import { connectAssistantDictation } from './client'
import { LiveDictationAdapter } from './dictationAdapter'
import { scriptedAnswersAtom, scriptedRequest } from './playground/scriptedAnswers'
import { captureDictationAudio } from './dictationAudio'
import { convertRatedMessage, useAssistantFeedback } from './useAssistantFeedback'
import type { StrobiAnimation } from './StrobiAvatar'
import { useAssistantQuotaSync } from './useAssistantQuota'
import { useAssistantSession } from './useAssistantSession'
import { useReadingContext } from './useReadingContext'
import { onboardingOnScreenAtom } from '~features/onboarding/atom'
import { useStrobiBubble } from './strobiBubble'
import { useStrobiTrial } from './useStrobiTrial'

const PREMIUM_PATH = '/premium'
// The daily meditation as stories covers the whole screen; the assistant waits behind it.
const DAILY_STORY_PATH = '/daily-story'

export default function AssistantLauncher() {
  const { id } = useSelector(selectUserLoginInfo)
  if (!useAssistantAccessible(id)) return null
  // A visitor finds Strobi too, once it is open to everyone; its page offers to sign in.
  if (!id) return <GuestAssistant />
  return <AccountAssistant key={id} account={id} />
}

/**
 * Where the bubble steps aside: the Premium page has its own Strobi, the daily meditation and the
 * large audio player cover the place it rests on, and on iOS its layer is above the onboarding's
 * full-screen modal.
 */
function useLauncherCovered() {
  const pathname = usePathname()
  const isAudioPlayerOpen = useAtomValue(bibleAudioPlayerOpenAtom)
  const onboardingOnScreen = useAtomValue(onboardingOnScreenAtom)
  return (
    onboardingOnScreen ||
    pathname === PREMIUM_PATH ||
    pathname === DAILY_STORY_PATH ||
    isAudioPlayerOpen
  )
}

/** Strobi's bubble for a visitor: it moves, sleeps and is put away like an account's. */
function GuestAssistant() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const covered = useLauncherCovered()
  const open = pathname === ASSISTANT_PATH
  const bubble = useStrobiBubble()
  const [asleep, setAsleep] = useState(false)
  const [dragged, setDragged] = useState(false)
  return (
    <AboveSheets>
      <AssistantLauncherButton
        animation={dragged ? 'excited' : asleep ? 'sleeping' : 'idle'}
        accessibilityLabel={t('assistant.modal.open')}
        hidden={open || covered}
        onPress={() => {
          if (!open) router.push(ASSISTANT_PATH)
        }}
        onAsleepChange={setAsleep}
        onDragStart={() => setDragged(true)}
        onDragEnd={() => setDragged(false)}
        onDismiss={bubble.confirmHide}
        dismissLabel={t('strobi.menu.hide')}
        // Put away, the bubble shrinks away; it comes back from Strobi's settings page.
        putAway={bubble.hidden}
      />
    </AboveSheets>
  )
}

/**
 * Holds the conversation at the root of the app and the floating button that opens it. The
 * conversation itself is a route (`study-assistant`): a form sheet on iOS, a page on Android,
 * which reads this state through `assistantPageAtom`, so an answer keeps streaming when the
 * page closes and a resource it opens is pushed above it.
 */
function AccountAssistant({ account }: { account: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const covered = useLauncherCovered()
  const open = pathname === ASSISTANT_PATH
  const liveContext = useReadingContext()
  const openInNewTab = useOpenInNewTab()
  const pushRoute = usePushRouteOnce()
  const publish = useSetAtom(assistantPageAtom)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [source, setSource] = useState<StudySource | null>(null)
  // Strobi falls asleep when its button is left alone, and wakes up when it is touched.
  const [avatarSleeping, setAvatarSleeping] = useState(false)
  const [avatarDragged, setAvatarDragged] = useState(false)
  const [dictationState, setDictationState] = useState<DictationState>('idle')
  const [dictation] = useState(
    () =>
      new LiveDictationAdapter({
        connect: connectAssistantDictation,
        capture: captureDictationAudio,
        onError: key => {
          toast.error(
            i18n.t(
              key === 'assistant.dictation.permission'
                ? 'assistant.dictation.permissionDevice'
                : key
            )
          )
          setDictationState('error')
        },
        onState: setDictationState,
      })
  )
  useEffect(() => () => dictation.cancel(), [dictation])
  useEffect(() => {
    if (!open || historyOpen) dictation.cancel()
  }, [open, historyOpen, dictation])
  const scripted = useAtomValue(scriptedAnswersAtom)
  const reduceMotion = useReducedMotion()
  const session = useAssistantSession({
    account,
    signedIn: true,
    liveContext,
    reduceMotion,
    createRequest: () => (__DEV__ && scripted ? scriptedRequest(scripted) : undefined),
    onAction: action => {
      const tab = createTabForAssistantAction(action)
      if (!tab) {
        toast.error(t('assistant.unavailable'))
        return
      }
      // Going to the new tab dismisses every sheet, the assistant's included.
      openInNewTab(tab, { autoRedirect: true })
    },
    onRunStart: () => setHistoryOpen(false),
    onThreadSwitch: () => {
      dictation.cancel()
      setHistoryOpen(false)
    },
    onCurrentThreadDeleted: () => dictation.cancel(),
  })
  const { current, ready, busy, send } = session
  const onboardingOnScreen = useAtomValue(onboardingOnScreenAtom)
  const bubble = useStrobiBubble()
  // With its bubble put away, Strobi does not open by itself either.
  useStrobiTrial({ session, open, enabled: !onboardingOnScreen && !bubble.hidden })
  useAssistantQuotaSync({ active: open, busy, error: session.error })
  // The daily quota used up, Strobi sleeps until it starts again, unless the account holds Premium.
  const premium = useAtomValue(premiumStatusAtom)
  const [restingUntil, setRestingUntil] = useState<number | null>(null)
  useEffect(() => {
    if (session.error === 'assistant.limit' || session.error === 'assistant.freePaused')
      setRestingUntil(nextQuotaReset(new Date()).getTime())
  }, [session.error])
  useEffect(() => {
    if (restingUntil === null) return
    const timer = setTimeout(() => setRestingUntil(null), restingUntil - Date.now())
    return () => clearTimeout(timer)
  }, [restingUntil])
  const resting = restingUntil !== null && premium.kind !== 'active'
  // A page asked for a new conversation on its question (a verse meditation): the meditation
  // closes first, and the sheet rises once its zoom has gone back to the card.
  const launch = useAtomValue(assistantLaunchAtom)
  const setLaunch = useSetAtom(assistantLaunchAtom)
  const startLaunch = useEffectEvent((request: AssistantLaunch) => {
    setLaunch(null)
    if (Date.now() - request.requestedAt > LAUNCH_TTL_MS) return
    if (!session.startPinnedThread(request.context, request.title)) return
    if (!open) router.push(ASSISTANT_PATH)
  })
  useEffect(() => {
    if (!launch || !ready || pathname === DAILY_STORY_PATH) return
    const timer = setTimeout(() => startLaunch(launch), 450)
    return () => clearTimeout(timer)
  }, [launch, ready, pathname])
  const onNew = async (message: AppendMessage) => {
    await send(message.content.flatMap(p => (p.type === 'text' ? [p.text] : [])).join('\n'))
  }
  const feedback = useAssistantFeedback()
  const runtime = useExternalStoreRuntime({
    adapters: { dictation, threadList: session.threadList, feedback: feedback.adapter(current) },
    messages: current.messages,
    convertMessage: convertRatedMessage,
    isRunning: busy,
    onNew,
    onCancel: async () => {
      session.cancel()
    },
    // Only the last answer is written again: see `regenerate`.
    ...(session.regenerate ? { onReload: async () => session.regenerate?.() } : {}),
  })
  const avatarAnimation: StrobiAnimation = busy
    ? 'thinking'
    : avatarDragged
      ? 'excited'
      : avatarSleeping || resting
        ? 'sleeping'
        : 'idle'
  const sheet: AssistantSheet = {
    session,
    liveContext,
    open,
    historyOpen,
    setHistoryOpen,
    close: () => {
      if (open) router.back()
    },
    navigate: route => pushRoute(route),
    showSource: setSource,
    source,
    dictation,
    dictationState,
  }
  // Published after every render: the page re-renders with the stream, the rest of the app does not.
  useEffect(() => {
    publish({ sheet, runtime })
  })
  useEffect(() => () => publish(null), [publish])
  useEffect(() => {
    if (!open) setSource(null)
  }, [open])
  if (!ready) return null
  return (
    <AboveSheets>
      <AssistantLauncherButton
        animation={avatarAnimation}
        accessibilityLabel={t('assistant.modal.open')}
        hidden={open || covered}
        onPress={() => {
          if (!open) router.push(ASSISTANT_PATH)
        }}
        onAsleepChange={setAvatarSleeping}
        onDragStart={() => setAvatarDragged(true)}
        onDragEnd={() => setAvatarDragged(false)}
        onDismiss={bubble.confirmHide}
        dismissLabel={t('strobi.menu.hide')}
        // Put away, the bubble shrinks away; it comes back from Strobi's settings page.
        putAway={bubble.hidden}
      />
    </AboveSheets>
  )
}

/**
 * On iOS a form sheet is a UIKit presentation laid over the whole React Native root, which held
 * the avatar under it. Its own layer of the window keeps it in front; the gestures there need
 * their own root.
 */
function AboveSheets({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') return children
  return (
    <FullWindowOverlay>
      <GestureHandlerRootView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </GestureHandlerRootView>
    </FullWindowOverlay>
  )
}
