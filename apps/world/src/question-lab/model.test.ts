import { expect, it } from 'vitest'
import { nextQuestion, exactAnswer, type Question } from './model'
const question = (id: string): Question => ({
  id,
  difficulty: 'easy',
  testament: 'old',
  factKey: id,
  reference: { book: 1, chapter: 1, verse: 1 },
  sourceUrl: 'https://example.org',
  fr: { question: 'Qui ?', answer: 'Noé', aliases: ['Noah'], explanation: 'Explication' },
  en: { question: 'Who?', answer: 'Noah', aliases: [], explanation: 'Explanation' },
})
it('avoids shown questions and recycles the oldest only when the pool is exhausted', () => {
  const questions = ['a', 'b', 'c'].map(question)
  expect(nextQuestion(questions, ['a', 'c'], () => 0)?.id).toBe('b')
  expect(nextQuestion(questions, ['b', 'c', 'a'])?.id).toBe('b')
  expect(nextQuestion([], [])?.id).toBeUndefined()
})
it('accepts accents and localized aliases without fuzzy false positives', () => {
  expect(exactAnswer(question('a'), 'fr', 'noe')).toBe(true)
  expect(exactAnswer(question('a'), 'fr', 'Noah')).toBe(true)
  expect(exactAnswer(question('a'), 'en', 'Moses')).toBe(false)
})
