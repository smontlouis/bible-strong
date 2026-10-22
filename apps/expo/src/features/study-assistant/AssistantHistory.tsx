import { Alert, StyleSheet } from 'react-native'
import { ThreadListItemPrimitive, ThreadListPrimitive } from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useAssistantSheet } from './assistantSheetContext'

function HistoryRow({ threadId }: { threadId: string }) {
  const { t } = useTranslation()
  const { session } = useAssistantSheet()
  const conversation = session.conversations.find(item => item.id === threadId)
  if (!conversation) return null
  const messageCount =
    conversation.summaryMessageCount === undefined
      ? conversation.messages.length
      : conversation.summaryMessageCount
  const exchanges = Math.floor(messageCount / 2)
  const title = conversation.title || t('assistant.modal.newChat')
  return (
    <ThreadListItemPrimitive.Root
      className="border-separator flex-row items-center "
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
    >
      <ThreadListItemPrimitive.Trigger disabled={session.busy} className="flex-1 py-3 pl-5">
        <Text className="text-[15px] font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-grey mt-[2px] text-[13px]">
          {new Date(conversation.updatedAt).toLocaleDateString()} · {exchanges}{' '}
          {t(exchanges === 1 ? 'assistant.modal.exchange' : 'assistant.modal.exchanges')}
        </Text>
      </ThreadListItemPrimitive.Trigger>
      <TouchableBox
        accessibilityRole="button"
        accessibilityLabel={`${t('assistant.modal.delete')} ${title}`}
        disabled={session.busy}
        onPress={() =>
          Alert.alert(t('assistant.modal.delete'), title, [
            { text: t('Annuler'), style: 'cancel' },
            {
              text: t('assistant.modal.delete'),
              style: 'destructive',
              onPress: () => session.threadList.onDelete(threadId),
            },
          ])
        }
        className="h-[48px] w-[54px] items-center justify-center"
      >
        <FeatherIcon name="trash-2" size={17} color="grey" />
      </TouchableBox>
    </ThreadListItemPrimitive.Root>
  )
}

function EmptyHistory() {
  const { t } = useTranslation()
  return (
    <Box className="px-5 py-8">
      <Text className="text-grey text-[15px]">{t('assistant.modal.noHistory')}</Text>
    </Box>
  )
}

export default function AssistantHistory() {
  const insets = useSafeAreaInsets()
  return (
    <ThreadListPrimitive.Items
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      ListEmptyComponent={EmptyHistory}
      renderItem={({ threadId }) => <HistoryRow threadId={threadId} />}
    />
  )
}
