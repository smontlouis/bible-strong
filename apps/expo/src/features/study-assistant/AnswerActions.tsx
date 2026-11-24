import type { ComponentProps } from 'react'
import { Share } from 'react-native'
import { ActionBarPrimitive, useAuiState } from '@assistant-ui/react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { answerPlainText } from './answerText'
import { feedbackAnswer } from './assistantFeedback'
import { questionsSpent } from './assistantQuota'
import type { Conversation } from './conversations'
import { useAssistantQuota } from './useAssistantQuota'
import { feedbackDraftAtom } from './useAssistantFeedback'

type IconName = ComponentProps<typeof FeatherIcon>['name']

const button = 'h-[36px] w-[34px] items-center justify-center'

const Icon = ({ name, active }: { name: IconName; active?: boolean }) => (
  <FeatherIcon name={name} size={16} color={active ? 'primary' : 'grey'} />
)

/**
 * What the reader does with a finished answer: copy it, share it, have it written again, and say
 * what they think of it while the assistant is in beta. The buttons are assistant-ui's action bar;
 * its feedback adapter keeps the thumb and opens the form of a thumb down (`useAssistantFeedback`).
 */
export default function AnswerActions({
  conversation,
  messageId,
  last,
}: {
  conversation: Conversation
  messageId: string
  /** Only the last answer can be written again. */
  last: boolean
}) {
  const { t } = useTranslation()
  const setDraft = useSetAtom(feedbackDraftAtom)
  const given = useAuiState(s => s.message.metadata?.submittedFeedback?.type)
  // With no question left today, writing again would trade the answer for a refusal.
  const quota = useAssistantQuota()
  const canReload = useAuiState(s => s.thread.capabilities.reload) && !questionsSpent(quota)
  const text = () => answerPlainText(feedbackAnswer(conversation, messageId).answer)
  return (
    <HStack className="mt-1 h-[36px] items-center" style={{ marginLeft: -9 }}>
      <ActionBarPrimitive.Copy
        accessibilityLabel={t('Copier')}
        copyToClipboard={() => Clipboard.setString(text())}
        hitSlop={4}
        className={button}
      >
        {({ isCopied }) => <Icon name={isCopied ? 'check' : 'copy'} active={isCopied} />}
      </ActionBarPrimitive.Copy>
      <TouchableBox
        accessibilityRole="button"
        accessibilityLabel={t('Partager')}
        onPress={() => void Share.share({ message: text() }).catch(() => {})}
        hitSlop={4}
        className={button}
      >
        <Icon name="share" />
      </TouchableBox>
      {last && canReload && (
        <ActionBarPrimitive.Reload
          accessibilityLabel={t('assistant.actions.regenerate')}
          hitSlop={4}
          className={button}
        >
          <Icon name="refresh-cw" />
        </ActionBarPrimitive.Reload>
      )}
      <ActionBarPrimitive.FeedbackPositive
        accessibilityLabel={t('assistant.feedback.up')}
        accessibilityState={{ selected: given === 'positive' }}
        hitSlop={4}
        className={button}
      >
        {({ isSubmitted }) => <Icon name="thumbs-up" active={isSubmitted} />}
      </ActionBarPrimitive.FeedbackPositive>
      <ActionBarPrimitive.FeedbackNegative
        accessibilityLabel={t('assistant.feedback.down')}
        accessibilityState={{ selected: given === 'negative' }}
        hitSlop={4}
        className={button}
      >
        {({ isSubmitted }) => <Icon name="thumbs-down" active={isSubmitted} />}
      </ActionBarPrimitive.FeedbackNegative>
      {given && (
        <TouchableBox
          accessibilityRole="button"
          onPress={() =>
            setDraft({
              kind: 'answer',
              answer: feedbackAnswer(conversation, messageId),
              rating: given === 'positive' ? 'up' : 'down',
            })
          }
          hitSlop={8}
          className="ml-2 shrink"
        >
          <Text className="text-link text-[13px]" numberOfLines={1}>
            {t('assistant.feedback.addComment')}
          </Text>
        </TouchableBox>
      )}
    </HStack>
  )
}
