import { useEffect, useState, type ReactNode } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { FullWindowOverlay } from 'react-native-screens'
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
import { assistantAccessible } from './assistantConfig'
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
import { convertMessage } from './messageRuntime'
import type { StrobiAnimation } from './StrobiAvatar'
import { useAssistantQuotaSync } from './useAssistantQuota'
import { useAssistantSession } from './useAssistantSession'
import { useReadingContext } from './useReadingContext'

const PREMIUM_PATH = '/premium'

export default function AssistantLauncher() {
  const { id } = useSelector(selectUserLoginInfo)
  if (!assistantAccessible(id)) return null
  return <AccountAssistant key={id} account={id} />
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
  const open = pathname === ASSISTANT_PATH
  const liveContext = useReadingContext()
  const openInNewTab = useOpenInNewTab()
  const pushRoute = usePushRouteOnce()
  const publish = useSetAtom(assistantPageAtom)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [source, setSource] = useState<StudySource | null>(null)
  // Strobi falls asleep when its button goes idle, and wakes up with it.
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
  const onNew = async (message: AppendMessage) => {
    await send(message.content.flatMap(p => (p.type === 'text' ? [p.text] : [])).join('\n'))
  }
  const runtime = useExternalStoreRuntime({
    adapters: { dictation, threadList: session.threadList },
    messages: current.messages,
    convertMessage,
    isRunning: busy,
    onNew,
    onCancel: async () => {
      session.cancel()
    },
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
        // The Premium page has its own Strobi.
        hidden={open || pathname === PREMIUM_PATH}
        onPress={() => {
          if (!open) router.push(ASSISTANT_PATH)
        }}
        onIdleChange={setAvatarSleeping}
        onDragStart={() => setAvatarDragged(true)}
        onDragEnd={() => setAvatarDragged(false)}
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
