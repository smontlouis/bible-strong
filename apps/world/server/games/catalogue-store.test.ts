import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CatalogueStore, type CatalogueRequest } from './catalogue-store'
import { catalogueRevision, identitySeed, questionSeed } from './catalogue-seed.generated'
import { sqliteStorage } from './sqlite-test'

let database: ReturnType<typeof sqliteStorage>, store: CatalogueStore
beforeEach(() => {
  database = sqliteStorage()
  store = new CatalogueStore(database.storage)
  store.seed(catalogueRevision, questionSeed, identitySeed)
})
afterEach(() => database.db.close())
function request(overrides: Partial<CatalogueRequest> = {}): CatalogueRequest {
  return {
    operation: crypto.randomUUID(),
    count: 5,
    players: ['visitor-a'],
    exclude: [],
    options: {
      mode: 'solo',
      kind: 'quiz',
      difficulty: 'easy',
      testament: 'old',
      language: 'fr',
      subject: 'mixed',
    },
    ...overrides,
  }
}
it('imports all 1,400 cards once and selects valid written questions in every language/filter', () => {
  expect(database.db.prepare('SELECT COUNT(*) n FROM catalogue_questions').get()?.n).toBe(1400)
  for (const language of ['fr', 'en'] as const)
    for (const difficulty of ['easy', 'medium', 'hard'] as const)
      for (const testament of ['old', 'new'] as const) {
        const r = request()
        r.options = { ...r.options, language, difficulty, testament }
        const rounds = store.select(r)
        expect(new Set(rounds.map(r => r.catalogueId)).size).toBe(5)
        for (const round of rounds) {
          const source = questionSeed.find(q => q.id === round.catalogueId)!
          expect(source).toMatchObject({ difficulty, testament })
          expect(round.question).toBe(source[language].question)
          expect(round.choices).toEqual([])
          expect(round.clues).toEqual([])
          expect(round.answer).toBe(source[language].answer)
          expect(round.sources).toHaveLength(1)
          expect(round.aliases).toContain(source[language === 'fr' ? 'en' : 'fr'].answer)
        }
      }
})
it('uses all four ordered sourced clues for Who am I, without inventing difficulty tiers', () => {
  for (const language of ['fr', 'en'] as const) {
    const r = request()
    r.options = {
      ...r.options,
      kind: 'who',
      mode: 'together',
      language,
      testament: 'new',
      difficulty: 'hard',
    }
    for (const round of store.select(r)) {
      const source = identitySeed.find(q => q.id === round.catalogueId)!
      expect(source.testament).toBe('new')
      expect(round.clues).toEqual(source.clues.map(c => c[language]))
      expect(round.sources?.map(s => s.url)).toEqual(source.clues.map(c => c.sourceUrl))
      expect(round.question).toBe(language === 'fr' ? 'Qui suis-je ?' : 'Who am I?')
    }
  }
})
it('reserves the complete bounded solo deck before play, while keeping multiplayer batches small', () => {
  const solo = request({ count: 50 })
  const deck = store.select(solo)
  expect(deck).toHaveLength(50)
  expect(new Set(deck.map(q => q.catalogueId)).size).toBe(50)
  expect(store.select(solo)).toEqual(deck)
  expect(() =>
    store.select({ ...request({ count: 50 }), options: { ...solo.options, mode: 'together' } })
  ).toThrow('Invalid catalogue allocation')
})
it('prefers questions unseen by everyone, sharing history between languages, modes and rooms', () => {
  const first = store.select(request(), 100)
  const r = request({ players: ['visitor-a', 'visitor-b'] })
  r.options.mode = 'together'
  r.options.language = 'en'
  const second = store.select(r, 200)
  expect(second.some(q => first.some(f => f.catalogueId === q.catalogueId))).toBe(false)
  const third = store.select(request({ players: ['visitor-b'] }), 300)
  expect(third.some(q => second.some(f => f.catalogueId === q.catalogueId))).toBe(false)
})
it('replays allocations idempotently without consuming more history and rejects changed inputs', () => {
  const r = request()
  const first = store.select(r, 100)
  expect(store.select(r, 200)).toEqual(first)
  expect(database.db.prepare('SELECT SUM(times_seen) n FROM catalogue_history').get()?.n).toBe(5)
  expect(() => store.select({ ...r, count: 4 }, 300)).toThrow('reused')
})
it('recycles least recently offered questions only after exhaustion; exclusions never recycle', () => {
  const subset = questionSeed
    .filter(q => q.difficulty === 'easy' && q.testament === 'old')
    .slice(0, 7)
  store.seed('small', subset, [])
  const first = store.select(request({ count: 5 }), 100)
  const second = store.select(request({ count: 2 }), 200)
  expect(second.some(q => first.some(f => f.catalogueId === q.catalogueId))).toBe(false)
  const recycled = store.select(request({ count: 5 }), 300)
  expect(new Set(recycled.map(q => q.catalogueId))).toEqual(new Set(first.map(q => q.catalogueId)))
  const excluded = first.map(q => q.catalogueId!)
  expect(() => store.select(request({ exclude: excluded }), 400)).toThrow('Not enough')
  expect(
    store
      .select(request({ count: 2, exclude: excluded }), 400)
      .map(q => q.catalogueId)
      .sort()
  ).toEqual(second.map(q => q.catalogueId).sort())
})
it('rolls back a failed seed and preserves history when revising or adding content', () => {
  store.select(request(), 100)
  expect(() => store.seed('bad', [questionSeed[0], questionSeed[0]], [])).toThrow()
  expect(database.db.prepare('SELECT COUNT(*) n FROM catalogue_questions').get()?.n).toBe(1400)
  expect(database.db.prepare('SELECT revision FROM catalogue_meta').get()?.revision).toBe(
    catalogueRevision
  )
  store.seed('revised', questionSeed, identitySeed)
  expect(database.db.prepare('SELECT COUNT(*) n FROM catalogue_history').get()?.n).toBe(5)
})
it('retains allocations and history after closing and reopening the SQLite database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'world-catalogue-'))
  const path = join(directory, 'catalogue.sqlite')
  let disk = sqliteStorage(path)
  try {
    let saved = new CatalogueStore(disk.storage)
    saved.seed(catalogueRevision, questionSeed, identitySeed)
    const r = request()
    const first = saved.select(r)
    disk.db.close()
    disk = sqliteStorage(path)
    saved = new CatalogueStore(disk.storage)
    saved.seed(catalogueRevision, questionSeed, identitySeed)
    expect(saved.select(r)).toEqual(first)
    expect(
      saved.select(request()).some(q => first.some(f => f.catalogueId === q.catalogueId))
    ).toBe(false)
  } finally {
    disk.db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
