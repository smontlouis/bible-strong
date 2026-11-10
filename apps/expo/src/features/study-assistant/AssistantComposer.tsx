import { use } from 'react'
import { useAtomValue } from 'jotai'
import { ActivityIndicator } from 'react-native'
import { ComposerPrimitive, useAui } from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardState } from '~common/KeyboardAwareScrollView'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { premiumStatusAtom } from '~features/premium/premiumStatus'
import { usePremiumVisible } from '~features/premium/premiumVisibility'
import useLanguage from '~helpers/useLanguage'
import { useTheme } from '~themes/ThemeProvider'
import { assistantAvailable } from './assistantConfig'
import AssistantComposerInput from './AssistantComposerInput'
import { ComposerInsetContext, useAssistantSheet } from './assistantSheetContext'
import { contextCaption } from './contextDisplay'
import ContextMarkIcon from './ContextMarkIcon'
import { quotaLine } from './assistantQuota'
import { useAssistantQuota } from './useAssistantQuota'

const ROUND_BUTTON = 'h-[34px] w-[34px] items-center justify-center rounded-full'

/** Stopping is a filled square, on native as on the web (Feather draws only an outline). */
const StopSquare = () => <Box className="bg-reverse h-[11px] w-[11px] rounded-[2px]" />

/**
 * What the reader is looking at goes with the question, as an attachment would: its mark and
 * name, and a cross to send the question without it. Taken off, it waits as a dashed chip.
 */
function ContextChip() {
  const { t } = useTranslation()
  const { session, liveContext } = useAssistantSheet()
  const { context } = session
  if (context) {
    const caption = contextCaption(context)
    return (
      <HStack className="bg-light-grey mr-2 h-[30px] shrink items-center gap-[6px] rounded-full pl-[10px] pr-[2px]">
        <ContextMarkIcon context={context} />
        <Text className="shrink text-[13px]" numberOfLines={1}>
          {caption}
        </Text>
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('assistant.modal.detachContext', { context: caption })}
          hitSlop={8}
          onPress={session.detachContext}
          className="h-[26px] w-[26px] items-center justify-center"
        >
          <FeatherIcon name="x" size={13} color="grey" />
        </TouchableBox>
      </HStack>
    )
  }
  if (liveContext) {
    const caption = contextCaption(liveContext)
    return (
      <TouchableBox
        accessibilityRole="button"
        accessibilityLabel={t('assistant.modal.attachContext', { context: caption })}
        onPress={session.attachContext}
        className="border-border mr-2 h-[30px] shrink flex-row items-center gap-[6px] rounded-full border border-dashed px-[10px]"
      >
        <FeatherIcon name="plus" size={13} color="grey" />
        <Text className="text-grey shrink text-[13px]" numberOfLines={1}>
          {caption}
        </Text>
      </TouchableBox>
    )
  }
  return <Box />
}

function DictationButton() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const aui = useAui()
  const { session, dictation, dictationState } = useAssistantSheet()
  if (session.busy) return null
  if (dictationState === 'idle' || dictationState === 'error')
    return (
      <TouchableBox
        accessibilityRole="button"
        accessibilityLabel={
          dictationState === 'error'
            ? `${t('assistant.dictation.error')} ${t('assistant.dictation.start')}`
            : t('assistant.dictation.start')
        }
        disabled={!session.ready || !assistantAvailable}
        onPress={() => {
          dictation.setTextLength(aui.composer.getState().text.length)
          aui.composer.startDictation()
        }}
        className={ROUND_BUTTON}
      >
        <FeatherIcon
          name={dictationState === 'error' ? 'alert-circle' : 'mic'}
          size={18}
          color={dictationState === 'error' ? 'quart' : 'grey'}
        />
      </TouchableBox>
    )
  const listening = dictationState === 'listening'
  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={t(
        dictationState === 'starting'
          ? 'assistant.dictation.starting'
          : dictationState === 'stopping'
            ? 'assistant.dictation.stopping'
            : 'assistant.dictation.stop'
      )}
      disabled={!listening}
      onPress={() => aui.composer.stopDictation()}
      className={`${ROUND_BUTTON} ${listening ? 'bg-quart' : ''}`}
    >
      {listening ? <StopSquare /> : <ActivityIndicator size="small" color={colors.grey} />}
    </TouchableBox>
  )
}

/**
 * What an account without Premium may still ask today, above the composer; where Premium is
 * sold, the way to ask without limit. Sending stays open at zero: the service checks Premium
 * again before it refuses, so a reader who has just subscribed elsewhere is answered.
 */
function QuotaLine() {
  const { t } = useTranslation()
  const lang = useLanguage()
  const { navigate } = useAssistantSheet()
  const premium = useAtomValue(premiumStatusAtom)
  const premiumVisible = usePremiumVisible()
  const line = quotaLine(useAssistantQuota(), lang)
  if (!line) return null
  const offersPremium = premium.kind === 'none' && premiumVisible
  return (
    <HStack
      accessibilityLiveRegion="polite"
      className="flex-wrap items-center justify-center gap-x-[6px] px-4 pb-[6px]"
    >
      <Text className="text-grey text-[12px]">
        {line.kind === 'remaining'
          ? t('assistant.quota.remaining', { count: line.count })
          : line.kind === 'paused'
            ? t('assistant.quota.paused', { date: line.date })
            : t('assistant.quota.none', { time: line.time })}
      </Text>
      {offersPremium && (
        <TouchableBox
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => navigate({ pathname: '/premium', params: { from: 'assistant' } })}
        >
          <Text className="text-link text-[12px]">{t('assistant.quota.premium')}</Text>
        </TouchableBox>
      )}
    </HStack>
  )
}

/** The page footer: it stays above the keyboard while the conversation scrolls behind it. */
export default function AssistantComposer() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { session, dictationState } = useAssistantSheet()
  const { busy, ready } = session
  const dictationActive = ['starting', 'listening', 'stopping'].includes(dictationState)
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardState(state => state.isVisible)
  const inset = use(ComposerInsetContext)
  return (
    <Box
      className="bg-reverse px-3 pt-1"
      onLayout={event => inset.setHeight(Math.ceil(event.nativeEvent.layout.height))}
      // Padding rather than margin, so the surface hides the conversation down to the edge.
      // Above the keyboard there is no home indicator to clear.
      style={{ paddingBottom: keyboardVisible ? 8 : insets.bottom + 4 }}
    >
      <QuotaLine />
      <ComposerPrimitive.Root className="border-border bg-reverse rounded-[24px] border px-2 pb-2 pt-1">
        <AssistantComposerInput
          multiline
          maxLength={4000}
          placeholder={t('assistant.modal.placeholder')}
          placeholderTextColor={colors.grey}
          accessibilityLabel={t('assistant.modal.placeholder')}
          editable={ready && assistantAvailable && !dictationActive}
          style={{
            color: colors.default,
            fontSize: 16,
            lineHeight: 22,
            minHeight: 40,
            maxHeight: 132,
            paddingHorizontal: 8,
            paddingTop: 9,
            paddingBottom: 9,
          }}
        />
        <HStack className="items-center justify-between">
          <ContextChip />
          <HStack className="items-center gap-1">
            <DictationButton />
            {busy ? (
              <ComposerPrimitive.Cancel
                accessibilityLabel={t('assistant.stop')}
                className={`${ROUND_BUTTON} bg-primary`}
              >
                <StopSquare />
              </ComposerPrimitive.Cancel>
            ) : (
              <ComposerPrimitive.Send
                accessibilityLabel={t('assistant.send')}
                disabled={!ready || !assistantAvailable || dictationActive || undefined}
                className={`${ROUND_BUTTON} bg-primary`}
              >
                <FeatherIcon name="arrow-up" size={18} color="reverse" />
              </ComposerPrimitive.Send>
            )}
          </HStack>
        </HStack>
      </ComposerPrimitive.Root>
    </Box>
  )
}
