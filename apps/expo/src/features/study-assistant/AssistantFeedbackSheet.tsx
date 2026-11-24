import { useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import Sheet from '~common/ModalSheet'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { HStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Chip from '~common/ui/Chip'
import { TextInput } from '~common/ui/InterfaceTextInput'
import { useSheetWellColor } from '~common/ui/SheetWell'
import Text from '~common/ui/Text'
import { toast } from '~helpers/toast'
import { useTheme } from '~themes/ThemeProvider'
import {
  FEEDBACK_REASONS,
  MAX_FEEDBACK_COMMENT,
  type FeedbackDraft,
  type FeedbackReason,
} from './assistantFeedback'
import { feedbackDraftAtom, useAssistantFeedback } from './useAssistantFeedback'

/**
 * Where an opinion is written: what went wrong with an answer, or what the reader thinks of
 * Strobi as a whole. Each page that asks for opinions mounts it for its own kind: the settings page
 * may lie over the conversation, and only one of the two sheets must answer a draft.
 */
export default function AssistantFeedbackSheet({ kind }: { kind: FeedbackDraft['kind'] }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const wellColor = useSheetWellColor()
  const feedback = useAssistantFeedback()
  const [draft, setDraft] = useAtom(feedbackDraftAtom)
  // The draft leaves as the sheet starts closing: what is on screen keeps its last one.
  const [shown, setShown] = useState<FeedbackDraft | null>(null)
  const [reasons, setReasons] = useState<FeedbackReason[]>([])
  const [comment, setComment] = useState('')
  const sheet = useRef<SheetRef>(null)
  useEffect(() => {
    if (!draft || draft.kind !== kind) return
    setShown(draft)
    setReasons([])
    setComment('')
    sheet.current?.present()
  }, [draft, kind])

  const down = shown?.kind === 'answer' && shown.rating === 'down'
  const empty = !comment.trim() && !reasons.length
  const send = () => {
    if (!shown || empty) return
    if (shown.kind === 'answer') feedback.comment(shown.answer, reasons, comment)
    else feedback.sendGeneral(comment)
    toast.success(t('assistant.feedback.sent'))
    sheet.current?.dismiss()
  }
  const toggle = (reason: FeedbackReason) =>
    setReasons(
      reasons.includes(reason) ? reasons.filter(item => item !== reason) : [...reasons, reason]
    )
  return (
    <Sheet
      ref={sheet}
      snapPoints={[0.6, 1]}
      onDismiss={() => setDraft(null)}
      header={
        <SheetHeader
          title={t(
            shown?.kind === 'general'
              ? 'assistant.feedback.generalTitle'
              : down
                ? 'assistant.feedback.downTitle'
                : 'assistant.feedback.upTitle'
          )}
        />
      }
    >
      <SheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {down && (
          <HStack className="mb-3 flex-wrap">
            {FEEDBACK_REASONS.map(reason => (
              <Chip
                key={reason}
                label={t(`assistant.feedback.reason.${reason}`)}
                isSelected={reasons.includes(reason)}
                onPress={() => toggle(reason)}
              />
            ))}
          </HStack>
        )}
        <TextInput
          multiline
          value={comment}
          onChangeText={setComment}
          maxLength={MAX_FEEDBACK_COMMENT}
          placeholder={t(
            shown?.kind === 'general'
              ? 'assistant.feedback.generalPlaceholder'
              : 'assistant.feedback.placeholder'
          )}
          placeholderTextColor={theme.colors.grey}
          accessibilityLabel={t('assistant.feedback.commentLabel')}
          className="text-default min-h-[110px] rounded-[12px] px-[14px] py-[12px] text-[15px]"
          style={{ backgroundColor: wellColor, textAlignVertical: 'top' }}
        />
        {shown?.kind === 'answer' && (
          <Text className="text-grey mt-3 text-[13px]">{t('assistant.feedback.attached')}</Text>
        )}
        <Box className="mt-5">
          <Button fullWidth disabled={empty} onPress={send}>
            {t('assistant.feedback.send')}
          </Button>
        </Box>
      </SheetScrollView>
    </Sheet>
  )
}
