import { expect, it } from 'vitest'
import { catalogue as questions } from './catalogue'
import { normalize } from './model'
it('contains four balanced batches of 300 bilingual questions without duplicate IDs, facts or wording', () => {
  expect(questions).toHaveLength(1200)
  for (const difficulty of ['easy', 'medium', 'hard'])
    for (const testament of ['old', 'new'])
      expect(
        questions.filter(q => q.difficulty === difficulty && q.testament === testament)
      ).toHaveLength(200)
  for (const batch of [1, 2, 3, 4]) {
    const lot = questions.filter(q => q.batch === batch)
    expect(lot).toHaveLength(300)
    for (const difficulty of ['easy', 'medium', 'hard'])
      for (const testament of ['old', 'new'])
        expect(
          lot.filter(q => q.difficulty === difficulty && q.testament === testament)
        ).toHaveLength(50)
  }
  for (const values of [
    questions.map(q => q.id),
    questions.map(q => q.factKey),
    ...(['fr', 'en'] as const).map(lang => questions.map(q => normalize(q[lang].question))),
  ])
    expect(new Set(values).size).toBe(1200)
  for (const q of questions) {
    expect(q.id).toMatch(
      new RegExp(`^${q.difficulty}-${q.testament === 'old' ? 'ot' : 'nt'}-\\d{3}$`)
    )
    const number = Number(q.id.split('-').at(-1))
    expect(number).toBeGreaterThan((q.batch - 1) * 50)
    expect(number).toBeLessThanOrEqual(q.batch * 50)
    expect(q.reference.book).toBeGreaterThanOrEqual(q.testament === 'old' ? 1 : 40)
    expect(q.reference.book).toBeLessThanOrEqual(q.testament === 'old' ? 39 : 66)
    expect(q.reference.chapter).toBeGreaterThan(0)
    expect(q.reference.verse).toBeGreaterThan(0)
    expect(new URL(q.sourceUrl).protocol).toBe('https:')
    for (const lang of ['fr', 'en'] as const) {
      expect(q[lang].question.length).toBeGreaterThan(15)
      expect(q[lang].answer.trim()).not.toBe('')
      expect(Array.isArray(q[lang].aliases)).toBe(true)
      expect(
        q[lang].aliases.every(alias => typeof alias === 'string' && alias.trim().length > 0)
      ).toBe(true)
      expect(q[lang].explanation.length).toBeGreaterThan(15)
    }
  }
})
