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
// number whose single sense has a code of its own, a number with many senses, and a number
// one sense of which is not named by a letter after it.
const MANY = [...'GHIJKLMNOPQRSTUVWXYZ'].map(suffix => `H2148${suffix}`)
const SENSES: Record<string, ReturnType<typeof entry>> = {
  H0001: entry('H0001', 'H0001', 'père'),
  H3404G: entry('H3404G', 'H3404', 'Jerija', 'Un Lévite, fils de Hébron.'),
  H3404H: entry('H3404H', 'H3404', 'Jerija', 'Un chef des Hébronites.'),
  H3293G: entry('H3293G', 'H3293', 'forêt'),
  ...Object.fromEntries(MANY.map(code => [code, entry(code, 'H2148', 'Zacharie', code)])),
  H5000A: entry('H5000A', 'H5000', 'premier'),
  H5000AB: entry('H5000AB', 'H5000', 'second'),
}
// What the lexicon answers a code with: a classical number names its first sense.
const NAMED: Record<string, string> = {
  H3404: 'H3404G',
  H3293: 'H3293G',
  H2148: 'H2148G',
  H5000: 'H5000A',
}

const answer = (path: string, query: Query): unknown => {
  const [, number] = /^\/v1\/strong-lexicon\/numbers\/(\w+)\/senses$/u.exec(path) ?? []
  if (number) {
    return {
      classicStrong: number,
      senses: Object.values(SENSES)
        .filter(sense => sense.classicStrong === number)
        .map(
          ({ stepCode, classicStrong, language, original, transliteration, gloss, ...told }) => ({
            stepCode,
            classicStrong,
            language,
            original,
            transliteration,
            gloss,
            detailedDefinitionHtml: told.definitionHtml,
            entityBrief: told.entity?.brief,
          })
        ),
    }
  }
  const [, code] = /^\/v1\/strong-lexicon\/entries\/(\w+)$/u.exec(path) ?? []
  if (code) return SENSES[NAMED[code] ?? code]
  if (path.endsWith('/identities/batch/counts')) {
    return {
      references: String(query.references)
        .split(',')
        .map(reference => ({
          reference,
          counts: SENSES[reference] ? [{ book: 13, verseCount: 2 }] : [],
        })),
    }
  }
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
const SENSE_COUNTS = '/identities/batch/counts'
const countedCodes = () =>
  vi
    .mocked(readResource)
    .mock.calls.filter(([path]) => path.endsWith(SENSE_COUNTS))
    .map(([, query]) => String(query?.references))
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

    // Where the senses are read is asked for with them, before they are known.
    expect(readsOf('/senses')).toEqual(['/v1/strong-lexicon/numbers/H3404/senses'])
    expect(readsOf(SENSE_COUNTS)).toHaveLength(1)
    detailedRead.release()
    expect(await page).toMatchObject({ kind: 'number', code: 'H3404' })
    expect(readsOf('/senses')).toHaveLength(1)
    expect(readsOf(SENSE_COUNTS)).toHaveLength(1)
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
    // The lexicon tells the senses apart and the Bible counts them all: no sense is read.
    expect(pathsRead().sort()).toEqual([
      '/v1/bibles/LSG/verses',
      '/v1/strong-bibles/LSG/books/1/identities/H3404/counts',
      '/v1/strong-bibles/LSG/books/1/identities/H3404/lemmas',
      '/v1/strong-bibles/LSG/books/1/identities/H3404/occurrences',
      '/v1/strong-bibles/LSG/books/1/identities/batch/counts',
      '/v1/strong-lexicon/entries/H3404',
      '/v1/strong-lexicon/entries/H3404',
      '/v1/strong-lexicon/numbers/H3404/senses',
    ])
  })

  it('reads a number of twenty senses in as many reads, never more at once than any page', async () => {
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
    expect(page).toMatchObject({ senses: MANY.map(code => ({ code, summary: code })) })
    expect(pathsRead()).toHaveLength(8)
    expect(most).toBeLessThanOrEqual(PAGE_READ_CONCURRENCY)
  })

  it('counts the verses of every code a sense can carry, and of a sense named otherwise', async () => {
    stubResourceApi()
    const page = await load('h5000')

    expect(page).toMatchObject({
      kind: 'number',
      senses: [
        { code: 'H5000A', verseCount: 2, books: [13] },
        { code: 'H5000AB', verseCount: 2, books: [13] },
      ],
    })
    const [candidates, others, ...more] = countedCodes()
    expect(candidates?.split(',')).toHaveLength(52)
    expect(candidates).toMatch(/^H5000A,H5000B,.*,H5000a,.*,H5000z$/u)
    expect(others).toBe('H5000AB')
    expect(more).toEqual([])
  })

  it('asks once more where the senses are read before failing the page', async () => {
    let failures = 1
    stubResourceApi(async path => {
      if (path.endsWith(SENSE_COUNTS) && failures > 0) {
        failures -= 1
        throw new Error('429')
      }
    })
    expect(await load('h3404')).toMatchObject({ kind: 'number', senses: [{ verseCount: 2 }, {}] })
    expect(readsOf(SENSE_COUNTS)).toHaveLength(2)

    failures = 2
    await expect(load('h3404')).rejects.toThrow('429')
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

  it('fails when the senses of a number cannot be asked for, rather than redirect it', async () => {
    // A Resource service older than the read answers that it does not exist.
    vi.mocked(readResource).mockImplementation(async (path, query = {}) =>
      path.endsWith('/senses') ? undefined : (answer(path, query) as never)
    )

    await expect(load('h3404')).rejects.toThrow('STRONG_NUMBER_SENSES_UNAVAILABLE')
    await expect(load('h3404G')).rejects.toThrow('STRONG_NUMBER_SENSES_UNAVAILABLE')
    expect(await load('h0001')).toMatchObject({ kind: 'sense', code: 'H0001' })
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
