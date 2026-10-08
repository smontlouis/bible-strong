import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE_READ_CONCURRENCY } from '../resources/pageReads'
import { readResource } from '../resources/resourceApi'
import { loadStrongConcordancePage, loadStrongPage } from './strong.functions'

vi.mock('../resources/resourceApi', () => ({ readResource: vi.fn() }))
// A server function is its handler here: the tests call it as the route does.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handle: (context: { data: unknown }) => unknown) => handle,
    }
    return builder
  },
}))
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }))

type Query = Record<string, string | number | undefined>

const entry = (stepCode: string, classicStrong: string, gloss: string, brief?: string) => ({
  stepCode,
  classicStrong,
  eStrong: classicStrong,
  language: 'hebrew',
  original: 'יְרִיָּה',
  transliteration: 'yerîyâh',
  gloss,
  definitionHtml: `<p>${gloss} (${stepCode})</p>`,
  relations: [],
  resources: [],
  entity: brief ? { name: gloss, brief, shortDescription: brief, description: brief } : undefined,
})

// A small lexicon: a number that is its own sense, a number told apart in two senses, a
// number whose single sense has a code of its own, and a number with more senses than a
// page reads at once.
const MANY = [...'GHIJKLMNOP'].map(suffix => `H2148${suffix}`)
const SENSES: Record<string, ReturnType<typeof entry>> = {
  H0001: entry('H0001', 'H0001', 'père'),
  H3404G: entry('H3404G', 'H3404', 'Jerija', 'Un Lévite, fils de Hébron.'),
  H3404H: entry('H3404H', 'H3404', 'Jerija', 'Un chef des Hébronites.'),
  H3293G: entry('H3293G', 'H3293', 'forêt'),
  ...Object.fromEntries(MANY.map(code => [code, entry(code, 'H2148', 'Zacharie', code)])),
}
// What the lexicon answers a code with: a classical number names its first sense.
const NAMED: Record<string, string> = { H3404: 'H3404G', H3293: 'H3293G', H2148: 'H2148G' }

const answer = (path: string, query: Query): unknown => {
  if (path === '/v1/strong-lexicon/entries/batch') {
    const asked = String(query.identities)
      .split(',')
      .map(identity => identity.replace('dstrong:', ''))
    return { entries: asked.flatMap(code => SENSES[code] ?? []) }
  }
  const [, code] = /^\/v1\/strong-lexicon\/entries\/(\w+)$/u.exec(path) ?? []
  if (code) return SENSES[NAMED[code] ?? code]
  if (path.endsWith('/counts')) return { counts: [{ book: 13, verseCount: 2 }] }
  if (path.endsWith('/occurrences')) {
    return { verses: [{ book: 13, chapter: 23, verse: 19, spans: [] }] }
  }
  if (path.endsWith('/lemmas')) return { lemmas: [{ lemma: '{Jerija}', occurrenceCount: 2 }] }
  if (path === '/v1/bibles/LSG/verses') {
    return { verses: [{ book: 13, chapter: 23, number: 19, text: 'Fils d’Hébron : Jerija' }] }
  }
  return undefined
}

/** A read that ends when the test says so. */
const pendingRead = () => {
  let release!: () => void
  const released = new Promise<void>(resolve => {
    release = resolve
  })
  return { released, release }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/** The API of that lexicon; `hold` keeps the reads it matches pending until released. */
const stubResourceApi = (hold?: (path: string, query: Query) => Promise<void> | undefined) => {
  vi.mocked(readResource).mockImplementation(async (path, query = {}) => {
    await hold?.(path, query)
    return answer(path, query) as never
  })
}

const pathsRead = () => vi.mocked(readResource).mock.calls.map(([path]) => path)
const readsOf = (suffix: string) => pathsRead().filter(path => path.endsWith(suffix))
const load = (code: string) => loadStrongPage({ data: { language: 'fr', code } })

beforeEach(() => {
  vi.mocked(readResource).mockReset()
})

describe('loadStrongPage', () => {
  it('reads a sense in six reads and never asks its number for its senses', async () => {
    stubResourceApi()
    const page = await load('h0001')

    expect(page).toMatchObject({
      kind: 'sense',
      code: 'H0001',
      concordance: { verseCount: 2, translations: [{ word: 'Jerija', count: 2 }] },
    })
    expect(page).not.toHaveProperty('incomplete', true)
    expect(pathsRead().sort()).toEqual([
      '/v1/bibles/LSG/verses',
      '/v1/strong-bibles/LSG/books/1/identities/H0001/counts',
      '/v1/strong-bibles/LSG/books/1/identities/H0001/lemmas',
      '/v1/strong-bibles/LSG/books/1/identities/H0001/occurrences',
      '/v1/strong-lexicon/entries/H0001',
      '/v1/strong-lexicon/entries/H0001',
    ])
  })

  it('asks for the verses of a code without waiting for its entry', async () => {
    const entryRead = pendingRead()
    stubResourceApi(path =>
      path.startsWith('/v1/strong-lexicon/entries/') ? entryRead.released : undefined
    )
    const page = load('h0001')
    await settle()

    // The entry has not answered: its verses were asked for with it, and read through.
    expect(readsOf('/counts')).toHaveLength(1)
    expect(readsOf('/lemmas')).toHaveLength(1)
    expect(readsOf('/verses')).toHaveLength(1)
    entryRead.release()
    expect(await page).toMatchObject({ kind: 'sense', code: 'H0001' })
  })

  it('asks a number for its senses as soon as one level of its entry names a sense', async () => {
    const detailedRead = pendingRead()
    stubResourceApi((path, query) =>
      path === '/v1/strong-lexicon/entries/H3404' && query.level === undefined
        ? detailedRead.released
        : undefined
    )
    const page = load('h3404')
    await settle()

    expect(readsOf('/batch')).toHaveLength(1)
    detailedRead.release()
    expect(await page).toMatchObject({ kind: 'number', code: 'H3404' })
    expect(readsOf('/batch')).toHaveLength(1)
  })

  it('lists the senses of a number with what tells them apart and where they are read', async () => {
    stubResourceApi()
    const page = await load('h3404')

    expect(page).toMatchObject({
      kind: 'number',
      code: 'H3404',
      glosses: ['Jerija'],
      senses: [
        { code: 'H3404G', summary: 'Un Lévite, fils de Hébron.', verseCount: 2, books: [13] },
        { code: 'H3404H', summary: 'Un chef des Hébronites.', verseCount: 2, books: [13] },
      ],
      concordance: { verseCount: 2 },
    })
    // The sense the number answered with is not read again.
    expect(pathsRead()).not.toContain('/v1/strong-lexicon/entries/H3404G')
    expect(pathsRead()).toHaveLength(10)
  })

  it('reads the senses of a number a few at a time', async () => {
    let inFlight = 0
    let most = 0
    stubResourceApi(async () => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await settle()
      inFlight -= 1
    })
    const page = await load('h2148')

    expect(page).toMatchObject({ kind: 'number', senses: { length: MANY.length } })
    expect(pathsRead().length).toBeGreaterThan(2 * PAGE_READ_CONCURRENCY)
    expect(most).toBe(PAGE_READ_CONCURRENCY)
  })

  it('leads a number with a single sense to that sense and reads no page there', async () => {
    stubResourceApi()

    expect(await load('h3293')).toEqual({ kind: 'moved', code: 'H3293G' })
    expect(pathsRead().filter(path => path.includes('/identities/H3293G/'))).toEqual([])
  })

  it('leads a code in another letter case to the sense that answers', async () => {
    stubResourceApi()

    expect(await load('h3404g')).toEqual({ kind: 'moved', code: 'H3404G' })
  })

  it('tells a sense of a split number where the page of its number is', async () => {
    stubResourceApi()

    expect(await load('h3404G')).toMatchObject({
      kind: 'sense',
      code: 'H3404G',
      number: { code: 'H3404', senseCount: 2 },
    })
  })

  it('shows a page whose translations cannot be read, and knows it is incomplete', async () => {
    stubResourceApi(async path => {
      if (path.endsWith('/lemmas')) throw new Error('429')
    })

    expect(await load('h0001')).toMatchObject({
      kind: 'sense',
      concordance: { verseCount: 2, translations: [] },
      incomplete: true,
    })
    expect(await load('h3404')).toMatchObject({ kind: 'number', incomplete: true })
  })

  it('fails when the entry or its verses cannot be read, so that no thin page is kept', async () => {
    stubResourceApi(async path => {
      if (path.endsWith('/counts')) throw new Error('429')
    })

    await expect(load('h0001')).rejects.toThrow('429')
  })

  it('has no page for a code the lexicon does not know', async () => {
    stubResourceApi()

    await expect(load('h9999')).rejects.toMatchObject({ isNotFound: true })
    await expect(load('h3404Z')).rejects.toMatchObject({ isNotFound: true })
  })
})

describe('loadStrongConcordancePage', () => {
  it('asks for the books of a code with its entry', async () => {
    const entryRead = pendingRead()
    stubResourceApi(path =>
      path.startsWith('/v1/strong-lexicon/entries/') ? entryRead.released : undefined
    )
    const page = loadStrongConcordancePage({ data: { language: 'fr', code: 'h0001' } })
    await settle()

    expect(readsOf('/counts')).toHaveLength(1)
    entryRead.release()
    expect(await page).toMatchObject({ code: 'H0001', verseCount: 2, pageCount: 1 })
    expect(readsOf('/counts')).toHaveLength(1)
  })

  it('sends the verses of a number that has a page to that page', async () => {
    stubResourceApi()

    expect(await loadStrongConcordancePage({ data: { language: 'fr', code: 'h3404' } })).toEqual({
      kind: 'number',
      code: 'H3404',
    })
  })
})
