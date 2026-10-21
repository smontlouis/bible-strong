import { ActivityIndicator } from 'react-native'
import { ThreadPrimitive } from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardState } from '~common/KeyboardAwareScrollView'
import { useSheetFooterInset } from '~common/sheet'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import { useAssistantSheet } from './assistantSheetContext'
import type { ReadingContext } from './conversations'
import ErrorState from './ErrorState'
import { AssistantMessage, UserMessage } from './MessageRenderer'

/** Starting points offered on an empty conversation, chosen from what the reader has open. */
const shortcutsFor = (context: ReadingContext | null) =>
  context && ['plan', 'meditation', 'entity', 'person', 'place', 'timeline'].includes(context.kind)
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

function ThreadStatus() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { session } = useAssistantSheet()
  const { current, busy, ready, error, retrying, progress, storageError, context } = session
  return (
    <Box>
      {!!progress && (
        <HStack accessibilityLiveRegion="polite" className="items-center gap-2 py-1">
          <ActivityIndicator size="small" color={colors.grey} />
          <Text className="text-grey text-[13px]">{progress}</Text>
        </HStack>
      )}
      {(!!error || retrying) && (
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
      {storageError && (
        <ErrorState
          title={t('assistant.errors.storageTitle')}
          detail={t('assistant.modal.storageError')}
        />
      )}
      {!current.messages.length && (
        <Box className="mt-2 gap-2">
          {shortcutsFor(context).map(key => (
            <ThreadPrimitive.Suggestion
              key={key}
              prompt={t(`assistant.modal.prompt.${key}`)}
              send
              disabled={busy || !ready}
              className="border-border flex-row items-center gap-2 rounded-[12px] border px-4 py-3"
            >
              <Text className="text-primary">›</Text>
              <Text className="flex-1 text-[15px]">{t(`assistant.modal.action.${key}`)}</Text>
            </ThreadPrimitive.Suggestion>
          ))}
        </Box>
      )}
    </Box>
  )
}

function Welcome() {
  const { t } = useTranslation()
  const { session } = useAssistantSheet()
  return (
    <Box className="pb-4 pt-8">
      <Text className="text-[24px] font-bold">{t('assistant.modal.welcome')}</Text>
      <Text className="text-grey mt-2 text-[15px]">
        {t(session.context ? 'assistant.modal.contextIntro' : 'assistant.modal.intro')}
      </Text>
    </Box>
  )
}

export default function AssistantThread() {
  const { session } = useAssistantSheet()
  const { current, busy, error } = session
  const insets = useSafeAreaInsets()
  const footerInset = useSheetFooterInset()
  // The footer rides the keyboard without resizing the list: the list makes room itself.
  const keyboardHeight = useKeyboardState(state => (state.isVisible ? state.height : 0))
  return (
    <ThreadPrimitive.MessagesFlatList
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 12,
        // The footer already clears the home indicator within its own height.
        paddingBottom: footerInset - insets.bottom + keyboardHeight + 12,
      }}
      ListHeaderComponent={current.messages.length ? null : Welcome}
      ListFooterComponent={ThreadStatus}
    >
      {({ message }) =>
        message.role === 'user' ? (
          <UserMessage />
        ) : (
          <AssistantMessage busy={busy} error={error} lastMessageId={current.messages.at(-1)?.id} />
        )
      }
    </ThreadPrimitive.MessagesFlatList>
  )
}
