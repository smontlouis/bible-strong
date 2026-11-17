import { dictionaryTermSlug } from '@bible-strong/resource-domain/contracts/dictionaryContract'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readResource } from '../resources/resourceApi'
import { loadDictionaryTermPage } from './dictionary.functions'
import { createDictionaryArticleSlug } from './dictionaryRoutes'

vi.mock('../resources/resourceApi', () => ({ readResource: vi.fn() }))
vi.mock('../resources/keptLikeAPage', () => ({ keptLikeAPage: {} }))
// A server function is its handler here: the tests call it as the route does.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      validator: () => builder,
      handler: (handle: (context: { data: unknown }) => unknown) => handle,
    }
    return builder
  },
}))

type Query = Record<string, string | number | undefined>

const source = (work: string, language: 'fr' | 'en', id: number, word: string) => ({
  resource: { kind: 'dictionary', work, language, revision: `${work}-r1` },
  resourceId: work.toUpperCase(),
  title: work.toUpperCase(),
  abbreviation: work.slice(0, 3),
  id,
  word,
  normalizedWord: word.toLowerCase(),
})

// Ephesus in two French dictionaries and an English one. The directory lists first a notion
// whose label only shares the first word of the slug.
const EPHESUS = {
  key: 'c:ephesus',
  label: 'Éphèse',
  normalizedLabel: 'ephese',
  correspondenceId: 'ephesus',
  sources: [
    source('easton', 'en', 1, 'Ephesus'),
    source('matthew', 'fr', 1, 'Ephese'),
    source('westphal', 'fr', 1, 'Éphèse'),
  ],
}
const NEIGHBOUR = {
  key: 'e:9:1',
  label: 'Éphèse (concile)',
  normalizedLabel: 'ephese (concile)',
  sources: [source('westphal', 'fr', 2, 'Éphèse (concile)')],
}

/** What the Resource API answers; `term` says whether it knows the route of a term. */
const answerWith = (term: 'known' | 'unknown') =>
  vi.mocked(readResource).mockImplementation(async (path: string, query: Query = {}) => {
    if (path === '/v1/dictionaries/terms/ephese') {
      return (
        term === 'known' ? { language: query.language, slug: 'ephese', notion: EPHESUS } : undefined
      ) as never
    }
    if (path === '/v1/dictionaries/terms/nothing') {
      return (term === 'known' ? { language: query.language, slug: 'nothing' } : undefined) as never
    }
    if (path === '/v1/dictionaries/directory') {
      return { language: query.language, items: [NEIGHBOUR, EPHESUS], limit: 100 } as never
    }
    if (path === '/v1/dictionaries') {
      return {
        dictionaries: ['matthew', 'westphal'].map(work => ({
          resource: { work },
          title: work,
          abbreviation: work,
          authors: [],
          description: '',
          edition: '',
          source: '',
          attribution: '',
        })),
      } as never
    }
    const entry = /^\/v1\/dictionaries\/([^/]+)\/fr\/entries\/by-id\/(\d+)$/u.exec(path)
    if (entry) {
      return {
        entry: {
          id: Number(entry[2]),
          word: 'Éphèse',
          definition: `<p>Article de ${entry[1]}.</p>`,
        },
      } as never
    }
    return undefined as never
  })

const load = (slug: string) => loadDictionaryTermPage({ data: { language: 'fr', slug } })
const pathsRead = () => vi.mocked(readResource).mock.calls.map(([path]) => path)

beforeEach(() => {
  vi.mocked(readResource).mockReset()
})

describe('loadDictionaryTermPage', () => {
  it('finds the notion by its slug in one read, as the search by its first word found it', async () => {
    answerWith('unknown')
    const searched = await load('ephese')
    expect(pathsRead()).toContain('/v1/dictionaries/directory')

    vi.mocked(readResource).mockReset()
    answerWith('known')
    const found = await load('ephese')

    expect(found).toEqual(searched)
    expect(found).toMatchObject({ kind: 'term', word: 'Éphèse', slug: 'ephese' })
    expect(vi.mocked(readResource).mock.calls[0]).toEqual([
      '/v1/dictionaries/terms/ephese',
      { language: 'fr' },
    ])
    expect(pathsRead()).not.toContain('/v1/dictionaries/directory')
  })

  it('has no page for a slug the Resource API knows no notion for, and searches nothing', async () => {
    answerWith('known')
    await expect(load('nothing')).rejects.toMatchObject({ isNotFound: true })
    expect(pathsRead()).toEqual(['/v1/dictionaries/terms/nothing'])
  })

  it('searches a slug too long for the Resource API instead of asking it', async () => {
    answerWith('known')
    const slug = `ephese-${'a'.repeat(200)}`
    await expect(load(slug)).rejects.toMatchObject({ isNotFound: true })
    expect(pathsRead()).toEqual(['/v1/dictionaries/directory'])
  })

  it('writes a slug as the Resource API compares it', () => {
    for (const heading of [
      'Ésaïe',
      'Cœur',
      'Æthiopie',
      'Straße',
      'İsrael',
      "L'Éternel",
      'Ephèse (ville)',
      '  Alpha et Oméga  ',
      'אֱלֹהִים',
      'ΚΥΡΙΟΣ',
      'Noël',
      '---',
    ]) {
      expect(dictionaryTermSlug(heading)).toBe(createDictionaryArticleSlug(heading))
    }
  })
})
