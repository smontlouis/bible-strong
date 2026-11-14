import { useEffect, useState } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai'
import { useRouter } from 'expo-router'
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AssistantRuntimeProvider, ThreadListPrimitive } from '@assistant-ui/react-native'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import ModalRouteFrame from '~navigation/ModalRouteFrame'
import AssistantComposer from './AssistantComposer'
import AssistantConsentCard from './AssistantConsentCard'
import AssistantHistory from './AssistantHistory'
import AssistantLimitCard from './AssistantLimitCard'
import { asksEmailVerification, questionsSpent } from './assistantQuota'
import {
  AssistantSheetContext,
  ComposerInsetContext,
  assistantPageAtom,
  useAssistantSheet,
} from './assistantSheetContext'
import AssistantThread from './AssistantThread'
import AssistantVerifyEmailCard from './AssistantVerifyEmailCard'
import SourceExcerptSheet from './SourceExcerptSheet'
import { useAssistantQuota } from './useAssistantQuota'

function PageHeader() {
  const { t } = useTranslation()
  const { session, historyOpen, setHistoryOpen, close } = useAssistantSheet()
  const { current, busy } = session
  const insets = useSafeAreaInsets()
  return (
    <HStack
      className="border-separator bg-reverse z-10 min-h-[50px] items-center pl-3 pr-2"
      style={{
        borderBottomWidth: StyleSheet.hairlineWidth,
        // iOS: room for the sheet's grabber. Android: a page under the status bar.
        paddingTop: Platform.OS === 'android' ? insets.top : 12,
        paddingBottom: 2,
      }}
    >
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
        // Android opens the assistant as a page: it needs its own way back. Strobi is not here:
        // it lives in the conversation, where it shows what the assistant does (2026-11-14).
        Platform.OS === 'android' && (
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={t('assistant.modal.close')}
            onPress={close}
            className="h-[44px] w-[40px] items-center justify-center"
          >
            <FeatherIcon name="arrow-left" size={20} />
          </TouchableBox>
        )
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

/**
 * The study assistant on iOS and Android: a full-height form sheet on iOS, a page on Android.
 * The conversation itself lives at the root (AssistantLauncher); a resource it opens is pushed
 * above this page, and closing that resource comes back to the conversation.
 */
export default function StudyAssistantScreen() {
  const router = useRouter()
  const page = useAtomValue(assistantPageAtom)
  const [composerHeight, setComposerHeight] = useState(0)
  const quota = useAssistantQuota()
  // Signed out, or the assistant is not offered to this account: nothing to show here.
  useEffect(() => {
    if (page) return
    const timer = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 0)
    return () => clearTimeout(timer)
  }, [page, router])
  if (!page) return null
  const { sheet, runtime } = page
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantSheetContext.Provider value={sheet}>
        <ComposerInsetContext.Provider
          value={{ height: composerHeight, setHeight: setComposerHeight }}
        >
          <ModalRouteFrame>
            <Box className="bg-reverse flex-1">
              <PageHeader />
              <Box className="flex-1 overflow-hidden">
                {sheet.historyOpen ? <AssistantHistory /> : <AssistantThread />}
              </Box>
              {!sheet.historyOpen &&
                sheet.session.consent.status === 'granted' &&
                // Nothing can be asked before the address is verified, nor once today's questions
                // are spent: the card that says why takes the composer's place.
                (asksEmailVerification(sheet.session.error, quota) && !sheet.session.busy ? (
                  <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
                    <AssistantVerifyEmailCard
                      limit={quota?.kind === 'verify_email' ? quota.limit : null}
                      docked
                    />
                  </Box>
                ) : questionsSpent(quota) && !sheet.session.busy ? (
                  <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
                    <AssistantLimitCard paused={quota?.kind === 'paused'} docked />
                  </Box>
                ) : (
                  <KeyboardStickyView
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
                  >
                    <AssistantComposer />
                  </KeyboardStickyView>
                ))}
              {/* Nothing is sent before the account agrees to share it with AI providers. */}
              {!sheet.historyOpen && sheet.session.consent.status === 'missing' && (
                <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
                  <AssistantConsentCard />
                </Box>
              )}
            </Box>
          </ModalRouteFrame>
          <SourceExcerptSheet source={sheet.source} onClose={() => sheet.showSource(null)} />
        </ComposerInsetContext.Provider>
      </AssistantSheetContext.Provider>
    </AssistantRuntimeProvider>
  )
}
