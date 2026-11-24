import type { ThreadMessageLike } from '@assistant-ui/react'
import { atom, getDefaultStore } from 'jotai'
import { useAtom, useSetAtom } from 'jotai/react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { saveAssistantFeedback } from '~helpers/assistantFeedbackFirestore'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import generateUUID from '~helpers/generateUUID'
import useLogin from '~helpers/useLogin'
import app from '../../../package.json'
import {
  commentRecord,
  feedbackAnswer,
  generalRecord,
  ratingRecord,
  rememberRating,
  type FeedbackAnswer,
  type FeedbackDraft,
  type FeedbackEnvironment,
  type FeedbackRating,
} from './assistantFeedback'
import type { Conversation, LocalMessage } from './conversations'
import { convertMessage } from './messageRuntime'

/**
 * The thumbs given from this device, by answer. Kept here and not read back from the account:
 * showing a thumb must not cost a read for every answer on screen.
 */
const ratingsAtom = atomWithAsyncStorage<Record<string, FeedbackRating>>(
  'assistant.feedback.ratings',
  {}
)

/**
 * A stored message as the conversation's runtime reads it, with the thumb this device remembers
 * for it: assistant-ui's feedback buttons show a thumb from the message itself.
 */
export function convertRatedMessage(message: LocalMessage): ThreadMessageLike {
  const converted = convertMessage(message)
  const rating = message.role === 'assistant' && getDefaultStore().get(ratingsAtom)[message.id]
  return rating
    ? {
        ...converted,
        metadata: {
          submittedFeedback: {
            type: rating === 'up' ? ('positive' as const) : ('negative' as const),
          },
        },
      }
    : converted
}

/** The opinion being written, shown by the feedback sheet. */
export const feedbackDraftAtom = atom<FeedbackDraft | null>(null)

export function useAssistantFeedback() {
  const { i18n } = useTranslation()
  const { isLogged, user } = useLogin()
  const account = isLogged ? user.id : null
  const [ratings, setRatings] = useAtom(ratingsAtom)
  const setDraft = useSetAtom(feedbackDraftAtom)
  const environment = (): FeedbackEnvironment => ({
    language: i18n.language,
    platform: Platform.OS,
    appVersion: app.version,
    now: Date.now(),
  })
  // Not awaited: offline, the write waits in Firestore's queue and goes out later.
  const write = (id: string, data: Record<string, unknown>) => {
    if (!account) return
    saveAssistantFeedback(account, id, data).catch(error => {
      if (__DEV__) console.warn('Assistant feedback not saved', error)
    })
  }
  return {
    /** Whether opinions can be given: they are kept with the account. */
    available: !!account,
    /** Completes the thumb given to an answer. */
    comment: (answer: FeedbackAnswer, reasons: readonly string[], text: string) =>
      write(answer.messageId, commentRecord(reasons, text, Date.now())),
    /** Sends an opinion on Strobi as a whole. */
    sendGeneral: (text: string) => write(generateUUID(), generalRecord(text, environment())),
    openDraft: setDraft,
    /**
     * What assistant-ui's feedback buttons call (`adapters.feedback`): the thumb is kept, and a
     * thumb down opens the form that asks what went wrong.
     */
    adapter: (conversation: Conversation) => ({
      submit: ({ message, type }: { message: { id: string }; type: 'positive' | 'negative' }) => {
        const answer = feedbackAnswer(conversation, message.id)
        const rating: FeedbackRating = type === 'positive' ? 'up' : 'down'
        if (ratings[message.id] !== rating) {
          setRatings(rememberRating(ratings, message.id, rating))
          write(message.id, ratingRecord(answer, rating, environment(), message.id in ratings))
        }
        setDraft(rating === 'down' ? { kind: 'answer', answer, rating } : null)
      },
    }),
  }
}
