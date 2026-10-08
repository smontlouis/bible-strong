import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readResource } from '../resources/resourceApi'
import { createPageReads, PAGE_READ_CONCURRENCY } from './biblePageReads'
import { loadVerseStudy } from './bibleVerseStudy'

vi.mock('../resources/resourceApi', () => ({ readResource: vi.fn() }))

type Query = Record<string, string | number | undefined>
type Answer = (path: string, query: Query) => unknown

const verse = { book: 43, chapter: 3, verse: 16 }
const carrying = ['BDS', 'BHG', 'DBY', 'LSG', 'NEG79', 'S21']

/** What the API answers; a path it does not know is a resource that does not exist. */
const answerWith = (answer: Answer) => {
  vi.mocked(readResource).mockImplementation(
    async (path, query = {}) => answer(path, query) as never
  )
}

const chapterOf = (versionId: string) => ({
  resource: { versionId },
  book: 43,
  chapter: 3,
  verses: [
    { number: 15, text: `${versionId} 15` },
    { number: 16, text: `${versionId}  16\n` },
  ],
})

const study = (reads = createPageReads(), versionId = 'LSG') =>
  loadVerseStudy({
    reads,
    language: 'fr',
    versionId,
    verse,
    verseText: Promise.resolve('Car Dieu a tant aimé le monde'),
    carrying: Promise.resolve(carrying),
    commenting: Promise.resolve([]),
  })

const pathsRead = () => vi.mocked(readResource).mock.calls.map(([path]) => path)

beforeEach(() => {
  vi.mocked(readResource).mockReset()
})

describe('loadVerseStudy', () => {
  it('reads the verse in the other Bibles and in the original language in one read', async () => {
    answerWith((path, query) =>
      path === '/v1/bibles/chapters'
        ? { chapters: String(query.versions).split(',').map(chapterOf) }
        : undefined
    )
    const found = await study()

    expect(vi.mocked(readResource).mock.calls).toContainEqual([
      '/v1/bibles/chapters',
      { versions: 'BDS,BHG,DBY,LSG,NEG79,S21', book: 43, chapter: 3 },
    ])
    expect(pathsRead().filter(path => path.endsWith('/verses'))).toEqual([])
    expect(found.versions.map(quote => [quote.label, quote.text, quote.path])).toEqual([
      ['Bible Segond 21 (S21)', 'S21 16', '/bible/s21/john/3/16'],
      ['Bible du Semeur (BDS)', 'BDS 16', '/bible/bds/john/3/16'],
      ['Nouvelle Edition de Genève 1979 (NEG79)', 'NEG79 16', '/bible/neg79/john/3/16'],
      ['Bible Darby (DBY)', 'DBY 16', '/bible/dby/john/3/16'],
    ])
    expect(found.original?.text).toBe('BHG 16')
  })

  it('asks the same read whatever Bible of the language is being read', async () => {
    answerWith(() => undefined)
    await study(createPageReads(), 'S21')
    await study(createPageReads(), 'OST')

    const together = vi
      .mocked(readResource)
      .mock.calls.filter(([path]) => path === '/v1/bibles/chapters')
      .map(([, query]) => query?.versions)
    expect(together).toEqual(['BDS,BHG,DBY,LSG,NEG79,S21', 'BDS,BHG,DBY,LSG,NEG79,S21'])
  })

  it('asks each Bible for the verse when their chapters are not answered together', async () => {
    answerWith(path => {
      const versionId = /^\/v1\/bibles\/([^/]+)\/verses$/u.exec(path)?.[1]
      return versionId && versionId !== 'BDS'
        ? { verses: [{ book: 43, chapter: 3, number: 16, text: `${versionId} alone` }] }
        : undefined
    })
    const reads = createPageReads()
    const found = await study(reads)

    expect(found.versions.map(quote => quote.text)).toEqual([
      'S21 alone',
      'NEG79 alone',
      'DBY alone',
    ])
    expect(found.original?.text).toBe('BHG alone')
    expect(reads.incomplete).toBe(false)
  })

  it('shows what it could read and knows the page is incomplete when a read fails', async () => {
    answerWith((path, query) => {
      if (path === '/v1/bibles/chapters') {
        return { chapters: String(query.versions).split(',').map(chapterOf) }
      }
      if (path.startsWith('/v1/naves/')) throw new Error('Resource API responded 429')
      return undefined
    })
    const reads = createPageReads()
    const found = await study(reads)

    expect(found.versions).toHaveLength(4)
    expect(found.topics).toEqual([])
    expect(reads.incomplete).toBe(true)
  })

  it('is whole when what it did not find does not exist', async () => {
    answerWith(() => undefined)
    const reads = createPageReads()
    const found = await study(reads)

    expect(found).toEqual({
      versions: [],
      original: undefined,
      words: [],
      crossReferences: [],
      comments: [],
      topics: [],
      dictionary: [],
    })
    expect(reads.incomplete).toBe(false)
  })

  it('keeps to the reads a page may have in flight', async () => {
    let inFlight = 0
    let most = 0
    vi.mocked(readResource).mockImplementation(async path => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await new Promise(resolve => setTimeout(resolve, 0))
      inFlight -= 1
      // The cross-references and the verses they name: two reads, one after the other.
      return (
        path.startsWith('/v1/cross-references/') ? { references: ['45-5-8', '62-4-9'] } : undefined
      ) as never
    })
    const commentaries = ['acbc', 'barnes', 'mhy-fr', 'aquifer-fr', 'fre-aug'].map(id => ({
      id,
      title: id,
      path: `/commentary/fr/${id}/john/3`,
    }))
    await loadVerseStudy({
      reads: createPageReads(),
      language: 'fr',
      versionId: 'LSG',
      verse,
      verseText: Promise.resolve(''),
      carrying: Promise.resolve(carrying),
      commenting: Promise.resolve(commentaries),
    })

    expect(pathsRead().length).toBeGreaterThan(PAGE_READ_CONCURRENCY)
    expect(most).toBe(PAGE_READ_CONCURRENCY)
  })
})
