import assert from 'node:assert/strict'
import test from 'node:test'

import type { ResourceQuery, ResourceReader } from '../resourceApi'
import { findLexiconEntries } from './search'

const entry = (stepCode: string, gloss: string, transliteration = '') => ({
  stepCode,
  gloss,
  transliteration,
  original: '',
  language: 'hebrew' as const,
})

type Page = { entries: ReturnType<typeof entry>[]; nextCursor?: string }

// A lexicon that answers as the Resource API does: a list by `search` or by `prefix`.
const lexiconOf = (answer: (query: ResourceQuery) => Page | undefined, asked: ResourceQuery[] = []) =>
  ({
    get: async (_path: string, query: ResourceQuery = {}) => {
      asked.push(query)
      return answer(query)
    },
    post: async () => undefined,
  }) as unknown as ResourceReader

const codes = (entries: readonly { stepCode: string }[]) => entries.map(found => found.stepCode)

test('the word asked for comes before the words that only hold it', async () => {
  const api = lexiconOf(query =>
    query.prefix
      ? { entries: [entry('H7327', 'Ruth'), entry('G4503', 'Ruth')] }
      : {
          // The order of a dictionary: "be truthful" long before "Ruth".
          entries: [entry('G0226', 'be truthful'), entry('H1628', 'Geruth'), entry('H7327', 'Ruth')],
        }
  )
  assert.deepEqual(codes(await findLexiconEntries(api, { query: 'Ruth', language: 'en', limit: 3 })), [
    'H7327',
    'G4503',
    'G0226',
  ])
})

test('a word is found by its transliteration, and by its translation without its accent', async () => {
  const api = lexiconOf(query =>
    query.prefix
      ? undefined
      : {
          entries: [
            entry('G0025', 'aimer', 'agapaō'),
            entry('G0026', 'amour', 'agapē'),
            entry('G5485', 'grâce', 'charis'),
          ],
        }
  )
  const first = async (query: string) =>
    codes(await findLexiconEntries(api, { query, language: 'fr', limit: 1 }))
  assert.deepEqual(await first('agape'), ['G0026'])
  assert.deepEqual(await first('grace'), ['G5485'])
})

test('the whole list is read for a short word that neither page holds', async () => {
  const asked: ResourceQuery[] = []
  const api = lexiconOf(query => {
    if (query.prefix) return { entries: [] }
    return query.limit === 500
      ? { entries: [entry('G1401', 'esclave'), entry('H2332', 'Ève')] }
      : { entries: [entry('G1401', 'esclave')], nextCursor: 'next' }
  }, asked)
  assert.deepEqual(codes(await findLexiconEntries(api, { query: 'Eve', language: 'fr', limit: 2 })), [
    'H2332',
    'G1401',
  ])
  assert.deepEqual(
    asked.map(query => [query.prefix ?? query.search, query.limit]),
    [
      ['Eve', 30],
      ['Eve', 100],
      ['Eve', 500],
    ]
  )
})

test('a list that fails to begin with the word leaves the search to answer', async () => {
  const api = lexiconOf(query => {
    if (query.prefix) throw new Error('unavailable')
    return { entries: [entry('H7965', 'paix')] }
  })
  assert.deepEqual(codes(await findLexiconEntries(api, { query: 'paix', language: 'fr', limit: 5 })), [
    'H7965',
  ])
})
