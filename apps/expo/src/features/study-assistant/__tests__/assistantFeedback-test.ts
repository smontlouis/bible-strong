import {
  commentRecord,
  feedbackAnswer,
  generalRecord,
  ratingRecord,
  rememberRating,
  type FeedbackRating,
} from '../assistantFeedback'
import type { Conversation, LocalMessage } from '../conversations'

const message = (id: string, role: LocalMessage['role'], text: string): LocalMessage => ({
  id,
  role,
  text,
  state: 'complete',
  createdAt: 1,
})

const conversation: Conversation = {
  id: 'conversation',
  title: 'Abel',
  updatedAt: 1,
  messages: [
    message('q1', 'user', 'Qui est Abel ?'),
    message('a1', 'assistant', 'Le fils d’Adam.'),
    message('q2', 'user', 'Et Caïn ?'),
    message('a2', 'assistant', 'Son frère.'),
  ],
}

const env = { language: 'fr', platform: 'ios', appVersion: '28.2.6', now: 10 }

it('pairs an answer with the question asked just before it', () => {
  expect(feedbackAnswer(conversation, 'a2')).toEqual({
    messageId: 'a2',
    conversationId: 'conversation',
    question: 'Et Caïn ?',
    answer: 'Son frère.',
  })
})

it('leaves the question empty rather than taking another message for it', () => {
  const orphan = { ...conversation, messages: conversation.messages.slice(1) }
  expect(feedbackAnswer(orphan, 'a1').question).toBe('')
  expect(feedbackAnswer(conversation, 'unknown')).toMatchObject({ question: '', answer: '' })
})

it('stores a thumb with the question and the answer it is about, bounded', () => {
  const long = { ...feedbackAnswer(conversation, 'a1'), answer: 'x'.repeat(30000) }
  const record = ratingRecord(long, 'down', env)
  expect(record).toMatchObject({
    schemaVersion: 1,
    kind: 'answer',
    rating: 'down',
    messageId: 'a1',
    question: 'Qui est Abel ?',
    language: 'fr',
    platform: 'ios',
    appVersion: '28.2.6',
    createdAt: 10,
  })
  expect(record.answer).toHaveLength(20000)
})

it('drops what was said of a thumb when another replaces it, and keeps its first date', () => {
  const record = ratingRecord(feedbackAnswer(conversation, 'a1'), 'up', env, true)
  expect(record).toMatchObject({ rating: 'up', reasons: [], comment: '', updatedAt: 10 })
  expect(record).not.toHaveProperty('createdAt')
})

it('keeps known reasons only and trims the comment', () => {
  expect(commentRecord(['sources', 'made_up', 'inaccurate'], '  Faux verset.  ', 20)).toEqual({
    reasons: ['inaccurate', 'sources'],
    comment: 'Faux verset.',
    updatedAt: 20,
  })
  expect(commentRecord([], 'x'.repeat(5000), 20).comment).toHaveLength(2000)
})

it('stores an opinion on Strobi as a whole without any conversation', () => {
  const record = generalRecord(' Très utile. ', env)
  expect(record).toMatchObject({ kind: 'general', comment: 'Très utile.' })
  expect(record).not.toHaveProperty('question')
})

it('remembers the last thumb per answer and forgets the oldest ones', () => {
  expect(rememberRating({ a: 'up' }, 'a', 'down')).toEqual({ a: 'down' })
  const many: Record<string, FeedbackRating> = {}
  for (let index = 0; index < 300; index++) many[`m${index}`] = 'up'
  const next = rememberRating(many, 'new', 'down')
  expect(Object.keys(next)).toHaveLength(300)
  expect(next.m0).toBeUndefined()
  expect(next.new).toBe('down')
})
