import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Animated, { FadeOut, withSpring, withTiming } from 'react-native-reanimated'
import {
  AssistantRuntimeProvider,
  ThreadListPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
} from '@assistant-ui/react-native'
import type { StudySource } from '@bible-strong/ai-contract/contract'
import Sheet from '~common/ModalSheet'
import { type SheetRef } from '~common/sheet'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { storage } from '~helpers/storage'
import { toast } from '~helpers/toast'
import i18n from '~i18n'
import { PushRouteGateContext } from '~navigation/pushRouteGate'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { selectUserLoginInfo } from '~redux/selectors/user'
import { createTabForAssistantAction } from './assistantActions'
import { assistantAccessible } from './assistantConfig'
import AssistantComposer from './AssistantComposer'
import AssistantHistory from './AssistantHistory'
import AssistantLauncherButton from './AssistantLauncherButton'
import {
  AssistantSheetContext,
  useAssistantSheet,
  type AssistantSheet,
  type DictationState,
} from './assistantSheetContext'
import AssistantThread from './AssistantThread'
import { connectAssistantDictation } from './client'
import { LiveDictationAdapter } from './dictationAdapter'
import { captureDictationAudio } from './dictationAudio'
import { convertMessage } from './messageRuntime'
import SourceExcerptSheet from './SourceExcerptSheet'
import StrobiAvatar, { type StrobiAnimation } from './StrobiAvatar'
import { useAssistantOpenRequest } from './useAssistantOpenRequest'
import { useAssistantSession } from './useAssistantSession'
import { useReadingContext } from './useReadingContext'

// The same per-account key as the web modal; MMKV plays the part of localStorage.
// Strobi lands in the sheet's header: it grows in with the bounce its button comes back with.
const strobiLanding = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.5 }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ scale: withSpring(1, { duration: 500, dampingRatio: 0.6 }) }],
    },
  }
}

const preferences = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
}

export default function AssistantLauncher() {
  const { id } = useSelector(selectUserLoginInfo)
  if (!assistantAccessible(id)) return null
  return <AccountAssistant key={id} account={id} />
}

function SheetHeader() {
  const { t } = useTranslation()
  const { session, open, historyOpen, setHistoryOpen } = useAssistantSheet()
  const { current, busy } = session
  return (
    <HStack className="border-border min-h-[50px] items-center border-b pl-3 pr-2">
      {historyOpen ? (
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('assistant.modal.back')}
          onPress={() => setHistoryOpen(false)}
          className="h-[44px] w-[40px] items-center justify-center"
        >
          <FeatherIcon name="arrow-left" size={20} />
        </TouchableBox>
      ) : (
        <Box className="h-[44px] w-[40px] items-center justify-center">
          {open && (
            <Animated.View entering={strobiLanding} exiting={FadeOut.duration(150)}>
              <StrobiAvatar animation={busy ? 'thinking' : 'excited'} size={34} />
            </Animated.View>
          )}
        </Box>
      )}
      <Text
        accessibilityRole="header"
        className="flex-1 pl-1 text-[16px] font-bold"
        numberOfLines={1}
      >
        {historyOpen ? t('assistant.modal.history') : current.title || t('assistant.modal.newChat')}
      </Text>
      {!historyOpen && (
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('assistant.modal.history')}
          disabled={busy}
          onPress={() => setHistoryOpen(true)}
          className="h-[44px] w-[44px] items-center justify-center"
        >
          <FeatherIcon name="clock" size={19} color={busy ? 'border' : 'default'} />
        </TouchableBox>
      )}
      <ThreadListPrimitive.New
        accessibilityLabel={t('assistant.new')}
        disabled={busy}
        className="h-[44px] w-[44px] items-center justify-center"
      >
        <FeatherIcon name="plus" size={21} color={busy ? 'border' : 'default'} />
      </ThreadListPrimitive.New>
    </HStack>
  )
}

function AccountAssistant({ account }: { account: string }) {
  const { t } = useTranslation()
  const liveContext = useReadingContext()
  const openInNewTab = useOpenInNewTab()
  const pushRoute = usePushRouteOnce()
  const sheet = useRef<SheetRef>(null)
  const afterClose = useRef<(() => void) | null>(null)
  const [open, setOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false)
  const [source, setSource] = useState<StudySource | null>(null)
  // Strobi falls asleep when its button goes idle, and wakes up with it.
  const [avatarSleeping, setAvatarSleeping] = useState(false)
  const [avatarDragged, setAvatarDragged] = useState(false)
  // The floating button leaves as the sheet starts rising and comes back as it starts closing.
  const [launcherHidden, setLauncherHidden] = useState(false)
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
  const closeThen = (action: () => void) => {
    if (!open) {
      action()
      return
    }
    afterClose.current = action
    sheet.current?.dismiss()
  }
  const session = useAssistantSession({
    account,
    signedIn: true,
    liveContext,
    preferenceStorage: () => preferences,
    onAction: action => {
      const tab = createTabForAssistantAction(action)
      if (!tab) {
        toast.error(t('assistant.unavailable'))
        return
      }
      closeThen(() => openInNewTab(tab, { autoRedirect: true }))
    },
    onRunStart: () => setHistoryOpen(false),
    onThreadSwitch: () => {
      dictation.cancel()
      setHistoryOpen(false)
    },
    onCurrentThreadDeleted: () => dictation.cancel(),
  })
  const { current, ready, busy, send } = session
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
  useAssistantOpenRequest(sheet)
  const avatarAnimation: StrobiAnimation = busy
    ? 'thinking'
    : avatarDragged
      ? 'excited'
      : avatarSleeping
        ? 'sleeping'
        : 'idle'
  const value: AssistantSheet = {
    session,
    liveContext,
    open,
    historyOpen,
    setHistoryOpen,
    close: () => sheet.current?.dismiss(),
    navigate: route => closeThen(() => pushRoute(route)),
    showSource: setSource,
    dictation,
    dictationState,
  }
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantSheetContext.Provider value={value}>
        {ready && (
          <AssistantLauncherButton
            animation={avatarAnimation}
            accessibilityLabel={t('assistant.modal.open')}
            hidden={launcherHidden}
            onPress={() => {
              setLauncherHidden(true)
              sheet.current?.present()
            }}
            onIdleChange={setAvatarSleeping}
            onDragStart={() => setAvatarDragged(true)}
            onDragEnd={() => setAvatarDragged(false)}
          />
        )}
        {/* Anything inside the sheet that pushes a route lets the sheet close first. */}
        <PushRouteGateContext.Provider value={closeThen}>
          <Sheet
            ref={sheet}
            // Expo's developer menu: 60% of the screen, then all of it.
            snapPoints={[0.6, 1]}
            header={<SheetHeader />}
            footer={historyOpen ? undefined : AssistantComposer}
            onOpenChange={setOpen}
            onPresentStart={() => setLauncherHidden(true)}
            onDismissStart={() => setLauncherHidden(false)}
            onDismiss={() => {
              setLauncherHidden(false)
              setSource(null)
              const action = afterClose.current
              afterClose.current = null
              action?.()
            }}
          >
            {historyOpen ? <AssistantHistory /> : <AssistantThread />}
            <SourceExcerptSheet source={source} onClose={() => setSource(null)} />
          </Sheet>
        </PushRouteGateContext.Provider>
      </AssistantSheetContext.Provider>
    </AssistantRuntimeProvider>
  )
}
