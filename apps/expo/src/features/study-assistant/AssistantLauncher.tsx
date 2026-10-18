import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
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

const AVATAR_SIZE = 52

// The same per-account key as the web modal; MMKV plays the part of localStorage.
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
          {open && <StrobiAvatar animation={busy ? 'thinking' : 'excited'} size={34} />}
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
  const insets = useSafeAreaInsets()
  const liveContext = useReadingContext()
  const openInNewTab = useOpenInNewTab()
  const pushRoute = usePushRouteOnce()
  const sheet = useRef<SheetRef>(null)
  const afterClose = useRef<(() => void) | null>(null)
  const [open, setOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false)
  const [source, setSource] = useState<StudySource | null>(null)
  const [avatarSleeping, setAvatarSleeping] = useState(false)
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
  useEffect(() => {
    if (open || !ready) return
    const sleepTimer = setTimeout(() => setAvatarSleeping(true), 10_000)
    return () => clearTimeout(sleepTimer)
  }, [open, ready])
  useAssistantOpenRequest(sheet)
  const avatarAnimation: StrobiAnimation = busy ? 'thinking' : avatarSleeping ? 'sleeping' : 'idle'
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
        {ready && !open && (
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={t('assistant.modal.open')}
            activeOpacity={0.7}
            onPress={() => {
              setAvatarSleeping(false)
              sheet.current?.present()
            }}
            className="absolute right-[14px] items-center justify-center"
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              bottom: insets.bottom + TAB_ICON_SIZE + 62,
            }}
          >
            <StrobiAvatar animation={avatarAnimation} size={AVATAR_SIZE} />
          </TouchableBox>
        )}
        {/* Anything inside the sheet that pushes a route lets the sheet close first. */}
        <PushRouteGateContext.Provider value={closeThen}>
          <Sheet
            ref={sheet}
            snapPoints={[1]}
            header={<SheetHeader />}
            footer={historyOpen ? undefined : AssistantComposer}
            onOpenChange={setOpen}
            onDismiss={() => {
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
