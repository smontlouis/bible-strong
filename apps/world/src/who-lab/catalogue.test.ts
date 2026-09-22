import { expect, it } from 'vitest'
import { identities } from './catalogue'
import { normalize } from '../question-lab/model'
it('provides 200 distinct bilingual identities in seven batches, each with four sourced clues', () => {
  expect(identities).toHaveLength(200)
  expect(new Set(identities.map(q => q.id)).size).toBe(200)
  for (const [category, count] of Object.entries({ person: 110, place: 52, object: 38 }))
    expect(identities.filter(q => q.category === category)).toHaveLength(count)
  for (const batch of [1, 2, 3, 4, 5, 6])
    expect(identities.filter(q => q.batch === batch)).toHaveLength(30)
  expect(identities.filter(q => q.batch === 7)).toHaveLength(20)
  for (const lang of ['fr', 'en'] as const) {
    expect(new Set(identities.map(q => normalize(q[lang].answer))).size).toBe(200)
    for (const category of ['person', 'place', 'object']) {
      const aliases = new Map<string, string>()
      for (const q of identities.filter(q => q.category === category)) {
        for (const answer of [q[lang].answer, ...q[lang].aliases]) {
          const key = normalize(answer)
          expect(aliases.get(key) ?? q.id, `Ambiguous ${lang} alias: ${answer}`).toBe(q.id)
          aliases.set(key, q.id)
        }
      }
    }
    const clues = identities.flatMap(q => q.clues.map(c => normalize(c[lang])))
    expect(new Set(clues).size).toBe(800)
  }
  for (const q of identities) {
    expect(q.clues.map(c => c.points)).toEqual([4, 3, 2, 1])
    expect(['old', 'new']).toContain(q.testament)
    for (const lang of ['fr', 'en'] as const) {
      expect(q[lang].answer.trim().length).toBeGreaterThan(1)
      expect(q[lang].explanation.trim().length).toBeGreaterThan(15)
      expect(Array.isArray(q[lang].aliases)).toBe(true)
      expect(q[lang].aliases.every(a => a.trim().length > 0)).toBe(true)
    }
    for (const c of q.clues) {
      expect(c.fr.length).toBeGreaterThan(15)
      expect(c.en.length).toBeGreaterThan(15)
      expect(c.reference.book).toBeGreaterThanOrEqual(1)
      expect(c.reference.book).toBeLessThanOrEqual(66)
      expect(c.reference.chapter).toBeGreaterThan(0)
      expect(c.reference.verse).toBeGreaterThan(0)
      expect(new URL(c.sourceUrl).protocol).toBe('https:')
    }
  }
})
