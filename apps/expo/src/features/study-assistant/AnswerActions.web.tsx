import { useState } from 'react'
import { ActionBarPrimitive, useAuiState } from '@assistant-ui/react'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'
import { answerPlainText } from './answerText'
import {
  FEEDBACK_REASONS,
  MAX_FEEDBACK_COMMENT,
  feedbackAnswer,
  type FeedbackReason,
} from './assistantFeedback'
import { questionsSpent } from './assistantQuota'
import type { Conversation } from './conversations'
import { useAssistantQuota } from './useAssistantQuota'
import { feedbackDraftAtom, useAssistantFeedback } from './useAssistantFeedback'

const paths = {
  copy: 'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  copied: 'M20 6 9 17l-5-5',
  reload:
    'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  up: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3',
  down: 'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17',
}

const Icon = ({ name }: { name: keyof typeof paths }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={paths[name]} />
  </svg>
)

/**
 * What the reader does with a finished answer: copy it, have it written again, and say what they
 * think of it while the assistant is in beta. The buttons are assistant-ui's action bar; its
 * feedback adapter keeps the thumb and opens the form of a thumb down (`useAssistantFeedback`).
 * The form opens in the answer's own flow: the conversation is already a dialog.
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
  const feedback = useAssistantFeedback()
  const [draft, setDraft] = useAtom(feedbackDraftAtom)
  const given = useAuiState(s => s.message.metadata?.submittedFeedback?.type)
  // With no question left today, writing again would trade the answer for a refusal.
  const quota = useAssistantQuota()
  const canReload = useAuiState(s => s.thread.capabilities.reload) && !questionsSpent(quota)
  const [copied, setCopied] = useState(false)
  const [reasons, setReasons] = useState<FeedbackReason[]>([])
  const [comment, setComment] = useState('')
  const writing = draft?.kind === 'answer' && draft.answer.messageId === messageId

  // The library's own copy button takes the answer as written, with the links that only work in
  // the conversation: this one copies what can be read elsewhere.
  const copy = async () => {
    const text = answerPlainText(feedbackAnswer(conversation, messageId).answer)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('Erreur lors du partage.'))
    }
  }
  const close = () => {
    setDraft(null)
    setReasons([])
    setComment('')
  }
  const empty = !comment.trim() && !reasons.length
  const send = () => {
    if (empty) return
    feedback.comment(feedbackAnswer(conversation, messageId), reasons, comment)
    toast.success(t('assistant.feedback.sent'))
    close()
  }
  const toggle = (reason: FeedbackReason) =>
    setReasons(
      reasons.includes(reason) ? reasons.filter(item => item !== reason) : [...reasons, reason]
    )
  return (
    <div className="bs-assistant-feedback" data-print-hide>
      <ActionBarPrimitive.Root className="bs-assistant-feedback-row">
        <button
          type="button"
          className="bs-assistant-icon"
          aria-label={t('Copier')}
          title={t('Copier')}
          aria-pressed={copied}
          onClick={() => void copy()}
        >
          <Icon name={copied ? 'copied' : 'copy'} />
        </button>
        {last && canReload && (
          <ActionBarPrimitive.Reload
            className="bs-assistant-icon"
            aria-label={t('assistant.actions.regenerate')}
            title={t('assistant.actions.regenerate')}
          >
            <Icon name="reload" />
          </ActionBarPrimitive.Reload>
        )}
        <ActionBarPrimitive.FeedbackPositive
          className="bs-assistant-icon"
          aria-label={t('assistant.feedback.up')}
          title={t('assistant.feedback.up')}
          aria-pressed={given === 'positive'}
        >
          <Icon name="up" />
        </ActionBarPrimitive.FeedbackPositive>
        <ActionBarPrimitive.FeedbackNegative
          className="bs-assistant-icon"
          aria-label={t('assistant.feedback.down')}
          title={t('assistant.feedback.down')}
          aria-pressed={given === 'negative'}
        >
          <Icon name="down" />
        </ActionBarPrimitive.FeedbackNegative>
        {given && !writing && (
          <span className="bs-assistant-feedback-thanks">
            <button
              type="button"
              onClick={() =>
                setDraft({
                  kind: 'answer',
                  answer: feedbackAnswer(conversation, messageId),
                  rating: given === 'positive' ? 'up' : 'down',
                })
              }
            >
              {t('assistant.feedback.addComment')}
            </button>
          </span>
        )}
      </ActionBarPrimitive.Root>
      {writing && (
        <form
          className="bs-assistant-feedback-form"
          onSubmit={event => {
            event.preventDefault()
            send()
          }}
        >
          {given === 'negative' && (
            <div
              className="bs-assistant-feedback-reasons"
              role="group"
              aria-label={t('assistant.feedback.downTitle')}
            >
              {FEEDBACK_REASONS.map(reason => (
                <button
                  key={reason}
                  type="button"
                  aria-pressed={reasons.includes(reason)}
                  onClick={() => toggle(reason)}
                >
                  {t(`assistant.feedback.reason.${reason}`)}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={comment}
            onChange={event => setComment(event.target.value)}
            maxLength={MAX_FEEDBACK_COMMENT}
            rows={3}
            placeholder={t('assistant.feedback.placeholder')}
            aria-label={t('assistant.feedback.commentLabel')}
          />
          <small>{t('assistant.feedback.attached')}</small>
          <div className="bs-assistant-feedback-actions">
            <button type="button" onClick={close}>
              {t('Annuler')}
            </button>
            <button type="submit" disabled={empty}>
              {t('assistant.feedback.send')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
