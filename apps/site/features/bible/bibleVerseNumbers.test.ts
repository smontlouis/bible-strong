import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNumberedToCount, listBibleVerseNumbers, verseProbeKeys } from './bibleVerseNumbers'

// A small Bible. Matthew 17 has no verse 21 and Numbers 1 translates verses 3 to 6 as
// one: neither is numbered from 1 to its count. 3 John is.
const VERSES: Record<string, number[]> = {
  '4-1': [1, 2, 3, 7, 8],
  '40-17': [...Array.from({ length: 20 }, (_, index) => index + 1), 22, 23, 24, 25, 26, 27],
  '64-1': Array.from({ length: 15 }, (_, index) => index + 1),
}

const coverage = (verses: Record<string, number[]>) => {
  const books = [...new Set(Object.keys(verses).map(key => Number(key.split('-')[0])))]
  return {
    resource: { kind: 'bible-text', versionId: 'ESV', revision: 'r1', textRevision: 'r1' },
    canon: { id: 'protestant-66', orderedBooks: Array.from({ length: 66 }, (_, book) => book + 1) },
    versification: 'bible-strong-default',
    books,
    chaptersByBook: Object.fromEntries(
      books.map(book => [
        String(book),
        Object.keys(verses)
          .filter(key => key.startsWith(`${book}-`))
          .map(key => Number(key.split('-')[1])),
      ])
    ),
    verseCountByBookChapter: Object.fromEntries(
      Object.entries(verses).map(([key, numbers]) => [key, numbers.length])
    ),
  }
}

/** The Resource API of that Bible: its coverage, the verses asked for, a chapter. */
const stubResourceApi = (
  verses: Record<string, number[]> = VERSES,
  published: object | null = coverage(verses)
) => {
  const requests: URL[] = []
  vi.stubGlobal('fetch', async (input: URL) => {
    requests.push(input)
    const json = (body: unknown) => new Response(JSON.stringify(body))
    if (!published) return new Response(null, { status: 404 })
    if (input.pathname.endsWith('/coverage')) return json(published)
    if (input.pathname.endsWith('/verses')) {
      const references = (input.searchParams.get('references') ?? '').split(',')
      return json({
        verses: references.flatMap(reference => {
          const [book, chapter, number] = reference.split('-').map(Number)
          return verses[`${book}-${chapter}`]?.includes(number!)
            ? [{ book, chapter, number, text: 'text' }]
            : []
        }),
      })
    }
    const [, book, chapter] = /books\/(\d+)\/chapters\/(\d+)$/u.exec(input.pathname) ?? []
    return json({
      book: Number(book),
      chapter: Number(chapter),
      verses: (verses[`${book}-${chapter}`] ?? []).map(number => ({ number, text: 'text' })),
    })
  })
  return requests
}

afterEach(() => vi.unstubAllGlobals())

describe('verse probes', () => {
  it('asks for the last number of a chapter and the ones after it', () => {
    expect(verseProbeKeys({ book: 40, chapter: 17, count: 26 })).toEqual([
      '40-17-26',
      '40-17-27',
      '40-17-28',
      '40-17-29',
    ])
    expect(verseProbeKeys({ book: 19, chapter: 119, count: 199 })).toEqual([
      '19-119-199',
      '19-119-200',
    ])
  })

  it('takes a chapter as numbered to its count when only its last number exists', () => {
    expect(isNumberedToCount(15, [15])).toBe(true)
    // A number is skipped before the end: the numbering goes past the count.
    expect(isNumberedToCount(26, [26, 27])).toBe(false)
    // Verses translated as one: the count itself is not a verse.
    expect(isNumberedToCount(5, [7, 8])).toBe(false)
    expect(isNumberedToCount(5, [])).toBe(false)
  })
})

describe('listBibleVerseNumbers', () => {
  it('numbers each chapter as the version does, in canon order', async () => {
    stubResourceApi()

    expect(await listBibleVerseNumbers('ESV')).toEqual([
      { book: 4, chapter: 1, verses: VERSES['4-1'] },
      { book: 40, chapter: 17, verses: VERSES['40-17'] },
      { book: 64, chapter: 1, verses: VERSES['64-1'] },
    ])
  })

  it('reads the coverage, one batch of probes, and only the chapters that skip numbers', async () => {
    const requests = stubResourceApi()
    await listBibleVerseNumbers('ESV')

    expect(requests.map(url => url.pathname)).toEqual([
      '/v1/bibles/ESV/coverage',
      '/v1/bibles/ESV/verses',
      '/v1/bibles/ESV/books/4/chapters/1',
      '/v1/bibles/ESV/books/40/chapters/17',
    ])
    expect(requests[1]!.searchParams.get('references')).toBe(
      '4-1-5,4-1-6,4-1-7,4-1-8,40-17-26,40-17-27,40-17-28,40-17-29,64-1-15,64-1-16,64-1-17,64-1-18'
    )
  })

  it('probes two hundred verses at a time', async () => {
    const chapters = Object.fromEntries(
      Array.from({ length: 120 }, (_, index) => [`19-${index + 1}`, [1, 2, 3]])
    )
    const requests = stubResourceApi(chapters)
    const listed = await listBibleVerseNumbers('ESV')

    expect(listed).toHaveLength(120)
    const probes = requests.filter(url => url.pathname.endsWith('/verses'))
    expect(probes.map(url => url.searchParams.get('references')!.split(',').length)).toEqual([
      200, 200, 80,
    ])
    expect(requests).toHaveLength(4)
  })

  it('trusts the numbers a coverage publishes and reads nothing else', async () => {
    const requests = stubResourceApi(VERSES, {
      ...coverage(VERSES),
      verseNumbersByBookChapter: { '4-1': VERSES['4-1'], '40-17': VERSES['40-17'] },
    })

    expect((await listBibleVerseNumbers('ESV')).map(({ verses }) => verses)).toEqual([
      VERSES['4-1'],
      VERSES['40-17'],
      VERSES['64-1'],
    ])
    expect(requests).toHaveLength(1)
  })

  it('numbers every chapter from 1 to its count when a coverage publishes no chapter', async () => {
    const regular = { '43-3': [1, 2, 3], '64-1': [1, 2] }
    const requests = stubResourceApi(regular, {
      ...coverage(regular),
      verseNumbersByBookChapter: {},
    })

    expect(await listBibleVerseNumbers('ESV')).toEqual([
      { book: 43, chapter: 3, verses: [1, 2, 3] },
      { book: 64, chapter: 1, verses: [1, 2] },
    ])
    expect(requests.map(url => url.pathname)).toEqual(['/v1/bibles/ESV/coverage'])
  })

  // The NIV keeps Matthew 17:21 as a row without text: the chapter counts 27 rows.
  const KEPT_BLANK = { '40-17': Array.from({ length: 27 }, (_, index) => index + 1) }

  it('leaves out a verse kept without text, which a coverage does not publish', async () => {
    const requests = stubResourceApi(KEPT_BLANK, {
      ...coverage(KEPT_BLANK),
      verseNumbersByBookChapter: { '40-17': VERSES['40-17'] },
    })

    const [chapter] = await listBibleVerseNumbers('NIV')
    expect(chapter?.verses).toHaveLength(26)
    expect(chapter?.verses).not.toContain(21)
    expect(requests).toHaveLength(1)
  })

  it('still lists a verse kept without text while the coverage publishes no numbers', async () => {
    stubResourceApi(KEPT_BLANK)

    const [chapter] = await listBibleVerseNumbers('NIV')
    expect(chapter?.verses).toEqual(KEPT_BLANK['40-17'])
  })

  it('has no verse for a title a coverage numbers 0, nor for a chapter without text', async () => {
    const psalms = { '19-3': [1, 2, 3, 4], '19-4': [1, 2] }
    stubResourceApi(psalms, {
      ...coverage(psalms),
      verseNumbersByBookChapter: { '19-3': [0, 1, 2, 3], '19-4': [] },
    })

    expect(await listBibleVerseNumbers('BHG')).toEqual([
      { book: 19, chapter: 3, verses: [1, 2, 3] },
      { book: 19, chapter: 4, verses: [] },
    ])
  })

  it('has no chapters for a version that is not published', async () => {
    const requests = stubResourceApi(VERSES, null)

    expect(await listBibleVerseNumbers('ESV')).toEqual([])
    expect(requests).toHaveLength(1)
  })

  it('fails when the Resource API does, so that no half-read list is kept', async () => {
    vi.stubGlobal('fetch', async (input: URL) =>
      input.pathname.endsWith('/coverage')
        ? new Response(JSON.stringify(coverage(VERSES)))
        : new Response(null, { status: 429 })
    )

    await expect(listBibleVerseNumbers('ESV')).rejects.toThrow('429')
  })
})
