import { ActivityIndicator } from 'react-native'
import { ComposerPrimitive, useAui } from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardState } from '~common/KeyboardAwareScrollView'
import { SheetFooter } from '~common/sheet'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import { assistantAvailable } from './assistantConfig'
import { useAssistantSheet } from './assistantSheetContext'
import { contextCaption } from './MessageRenderer'

const ROUND_BUTTON = 'h-[34px] w-[34px] items-center justify-center rounded-full'

function ContextChip() {
  const { t } = useTranslation()
  const { session, liveContext } = useAssistantSheet()
  const { context, pinned } = session
  if (context)
    return (
      <HStack
        className={`mr-2 h-[30px] shrink items-center rounded-full pl-1 pr-1 ${
          pinned ? 'bg-light-primary' : 'bg-light-grey'
        }`}
      >
        <TouchableBox
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(pinned) }}
          accessibilityLabel={t(pinned ? 'assistant.modal.unpin' : 'assistant.modal.pin')}
          hitSlop={8}
          onPress={() => session.setPinned(pinned ? null : { ...context })}
          className="h-[26px] w-[26px] items-center justify-center"
        >
          <FeatherIcon name="map-pin" size={13} color={pinned ? 'primary' : 'grey'} />
        </TouchableBox>
        <Text className="shrink text-[13px]" numberOfLines={1}>
          {contextCaption(context)}
        </Text>
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('assistant.modal.removeContext')}
          hitSlop={8}
          onPress={() => session.changeFollowReading(false)}
          className="h-[26px] w-[26px] items-center justify-center"
        >
          <FeatherIcon name="x" size={13} color="grey" />
        </TouchableBox>
      </HStack>
    )
  if (liveContext)
    return (
      <TouchableBox
        accessibilityRole="button"
        onPress={() => session.changeFollowReading(true)}
        className="border-border mr-2 h-[30px] justify-center rounded-full border px-3"
      >
        <Text className="text-grey text-[13px]">{t('assistant.modal.followReading')}</Text>
      </TouchableBox>
    )
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
      {listening ? (
        <FeatherIcon name="square" size={14} color="reverse" />
      ) : (
        <ActivityIndicator size="small" color={colors.grey} />
      )}
    </TouchableBox>
  )
}

/** The sheet footer: it stays above the keyboard while the conversation scrolls behind it. */
export default function AssistantComposer() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { session, dictationState } = useAssistantSheet()
  const { busy, ready } = session
  const dictationActive = ['starting', 'listening', 'stopping'].includes(dictationState)
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardState(state => state.isVisible)
  return (
    <SheetFooter
      className="bg-reverse px-3 pt-1"
      // Padding rather than margin, so the surface hides the conversation down to the edge.
      // Above the keyboard there is no home indicator to clear.
      style={{ marginBottom: 0, paddingBottom: keyboardVisible ? 8 : insets.bottom + 4 }}
    >
      <ComposerPrimitive.Root className="border-border bg-reverse rounded-[22px] border px-2 pb-2 pt-1">
        <ComposerPrimitive.Input
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
                <FeatherIcon name="square" size={14} color="reverse" />
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
    </SheetFooter>
  )
}
