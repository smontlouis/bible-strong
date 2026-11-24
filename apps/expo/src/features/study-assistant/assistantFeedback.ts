import type { Conversation } from './conversations'

/**
 * What a reader thinks of an answer, or of Strobi as a whole, while the assistant is in beta.
 * An opinion on an answer carries the question and the answer it is about, so that it can be read
 * on its own: the conversation may be gone by then. The reader is told so where they write it.
 */
export type FeedbackRating = 'up' | 'down'

export const FEEDBACK_REASONS = ['inaccurate', 'off_topic', 'sources', 'other'] as const
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]

export const MAX_FEEDBACK_COMMENT = 2000
const MAX_QUESTION = 5000
const MAX_ANSWER = 20000

/** The answer an opinion is about, with the question it answers. */
export type FeedbackAnswer = {
  messageId: string
  conversationId: string
  question: string
  answer: string
}

/** The opinion being written: on an answer, or on Strobi as a whole. */
export type FeedbackDraft =
  | { kind: 'answer'; answer: FeedbackAnswer; rating: FeedbackRating }
  | { kind: 'general' }

/** The answer of a conversation with the question asked just before it. */
export function feedbackAnswer(conversation: Conversation, messageId: string): FeedbackAnswer {
  const index = conversation.messages.findIndex(message => message.id === messageId)
  const answer = conversation.messages[index]
  const question = conversation.messages[index - 1]
  return {
    messageId,
    conversationId: conversation.id,
    question: question?.role === 'user' ? question.text : '',
    answer: answer?.text || '',
  }
}

export type FeedbackEnvironment = {
  language: string
  platform: string
  appVersion: string
  now: number
}

/**
 * The stored form of a thumb given on an answer. A thumb that replaces another keeps the date of
 * the first one and drops what was said about it: reasons for a thumb down say nothing of a thumb up.
 */
export const ratingRecord = (
  answer: FeedbackAnswer,
  rating: FeedbackRating,
  env: FeedbackEnvironment,
  replaces = false
) => ({
  schemaVersion: 1,
  kind: 'answer',
  rating,
  conversationId: answer.conversationId,
  messageId: answer.messageId,
  question: answer.question.slice(0, MAX_QUESTION),
  answer: answer.answer.slice(0, MAX_ANSWER),
  language: env.language,
  platform: env.platform,
  appVersion: env.appVersion,
  ...(replaces ? { reasons: [], comment: '' } : { createdAt: env.now }),
  updatedAt: env.now,
})

/** What the reader adds to a thumb: reasons, known ones only, and a comment. */
export const commentRecord = (reasons: readonly string[], comment: string, now: number) => ({
  reasons: FEEDBACK_REASONS.filter(reason => reasons.includes(reason)),
  comment: comment.trim().slice(0, MAX_FEEDBACK_COMMENT),
  updatedAt: now,
})

/** The stored form of an opinion on Strobi as a whole. */
export const generalRecord = (comment: string, env: FeedbackEnvironment) => ({
  schemaVersion: 1,
  kind: 'general',
  comment: comment.trim().slice(0, MAX_FEEDBACK_COMMENT),
  language: env.language,
  platform: env.platform,
  appVersion: env.appVersion,
  createdAt: env.now,
  updatedAt: env.now,
})

const MAX_REMEMBERED = 300

/** Adds a thumb to those this device remembers, the oldest ones leaving first. */
export function rememberRating(
  ratings: Record<string, FeedbackRating>,
  messageId: string,
  rating: FeedbackRating
): Record<string, FeedbackRating> {
  const { [messageId]: _, ...others } = ratings
  const kept = Object.entries(others).slice(-(MAX_REMEMBERED - 1))
  return { ...Object.fromEntries(kept), [messageId]: rating }
}
