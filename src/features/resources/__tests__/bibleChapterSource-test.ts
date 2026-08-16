import {
  createHttpBibleChapterAdapter,
  createHybridBibleChapterAdapter,
  getDevelopmentResourceApiBaseUrl,
  loadVerseTextsFromChapterAdapter,
  BibleVerseTextSourceError,
  type BibleChapterAdapter,
} from '../bibleChapterSource'

const verses = [{ Livre: 1, Chapitre: 1, Verset: 1, Texte: 'Au commencement' }]

const adapter = (
  result: Awaited<ReturnType<BibleChapterAdapter['loadChapter']>>
): BibleChapterAdapter => ({
  loadChapter: jest.fn().mockResolvedValue(result),
  loadCoverage: jest.fn().mockResolvedValue({
    status: 'available',
    coverage: { books: [1], chaptersByBook: { 1: [1] }, verseCountByBookChapter: { '1-1': 1 } },
  }),
})

describe('hybrid Bible chapter source', () => {
  it('loads comparison verses through the same source and preserves partial results', async () => {
    const source: BibleChapterAdapter = {
      loadChapter: jest
        .fn()
        .mockResolvedValueOnce({
          status: 'available',
          verses: [
            { Livre: 1, Chapitre: 1, Verset: 1, Texte: 'First' },
            { Livre: 1, Chapitre: 1, Verset: 2, Texte: 'Second' },
          ],
        })
        .mockResolvedValueOnce({
          status: 'unavailable',
          reason: 'chapter-not-available',
        }),
      loadCoverage: jest.fn(),
    }

    await expect(
      loadVerseTextsFromChapterAdapter(source, 'LSG', ['1-1-2', '1-2-1', 'invalid'])
    ).resolves.toEqual({ '1-1-2': 'Second' })
    expect(source.loadChapter).toHaveBeenCalledTimes(2)
  })

  it('preserves verse zero when resolving BHG Psalm superscriptions', async () => {
    const source = adapter({
      status: 'available',
      verses: [{ Livre: 19, Chapitre: 3, Verset: 0, Texte: 'A Psalm of David' }],
    })

    await expect(loadVerseTextsFromChapterAdapter(source, 'BHG', ['19-3-0'])).resolves.toEqual({
      '19-3-0': 'A Psalm of David',
    })
  })

  it('preserves a structured source failure when no requested verse can be resolved', async () => {
    const source = adapter({ status: 'unavailable', reason: 'network-offline' })

    await expect(loadVerseTextsFromChapterAdapter(source, 'LSG', ['1-1-1'])).rejects.toMatchObject({
      name: 'BibleVerseTextSourceError',
      reason: 'network-offline',
    } satisfies Partial<BibleVerseTextSourceError>)
  })

  it('loads remote coverage when no Offline Bible copy is installed', async () => {
    const offline = adapter({ status: 'unavailable', reason: 'publication-not-available' })
    jest.mocked(offline.loadCoverage).mockResolvedValue({
      status: 'available',
      coverage: { books: [], chaptersByBook: {}, verseCountByBookChapter: {} },
    })
    const online = adapter({ status: 'available', verses })
    const remoteCoverage = {
      books: [1, 2],
      chaptersByBook: { 1: [1, 2], 2: [1] },
      verseCountByBookChapter: { '1-1': 31, '1-2': 25, '2-1': 22 },
    }
    jest.mocked(online.loadCoverage).mockResolvedValue({
      status: 'available',
      coverage: remoteCoverage,
    })

    await expect(
      createHybridBibleChapterAdapter({ offline, online }).loadCoverage('LSG')
    ).resolves.toEqual({ status: 'available', coverage: remoteCoverage })
  })

  it('always prefers a valid installed Offline copy', async () => {
    const offline = adapter({ status: 'available', verses })
    const online = adapter({
      status: 'available',
      verses: [{ ...verses[0], Texte: 'Different remote revision' }],
    })
    const hybrid = createHybridBibleChapterAdapter({ offline, online })

    await expect(hybrid.loadChapter('LSG', 1, 1)).resolves.toEqual({
      status: 'available',
      verses,
    })
    expect(online.loadChapter).not.toHaveBeenCalled()
  })

  it.each(['publication-not-available', 'offline-copy-invalid'] as const)(
    'falls back to HTTP when the local copy reports %s',
    async reason => {
      const offline = adapter({ status: 'unavailable', reason })
      const online = adapter({ status: 'available', verses })

      await expect(
        createHybridBibleChapterAdapter({ offline, online }).loadChapter('LSG', 1, 1)
      ).resolves.toEqual({ status: 'available', verses })
    }
  )

  it('does not source-hop after a genuine local domain not-found', async () => {
    const offline = adapter({ status: 'unavailable', reason: 'chapter-not-available' })
    const online = adapter({ status: 'available', verses })

    await expect(
      createHybridBibleChapterAdapter({ offline, online }).loadChapter('LSG', 1, 200)
    ).resolves.toEqual({ status: 'unavailable', reason: 'chapter-not-available' })
    expect(online.loadChapter).not.toHaveBeenCalled()
  })

  it('preserves a local integrity outcome when HTTP cannot recover it', async () => {
    const offline = adapter({ status: 'unavailable', reason: 'offline-copy-invalid' })
    const online = adapter({ status: 'unavailable', reason: 'network-offline' })

    await expect(
      createHybridBibleChapterAdapter({ offline, online }).loadChapter('LSG', 1, 1)
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'offline-copy-invalid',
      recoveries: ['manage-offline-copies', 'reset-offline-store'],
    })
  })

  it('keeps the corrupt-copy recovery when the remote does not support the version', async () => {
    const offline = adapter({ status: 'unavailable', reason: 'offline-copy-invalid' })
    const online = adapter({ status: 'unavailable', reason: 'resource-unsupported' })

    await expect(
      createHybridBibleChapterAdapter({ offline, online }).loadChapter('DBY', 1, 1)
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'offline-copy-invalid',
      recoveries: ['manage-offline-copies', 'reset-offline-store'],
    })
  })
})

describe('HTTP Bible chapter adapter', () => {
  it('uses simulator-safe local defaults without embedding one localhost assumption', () => {
    expect(getDevelopmentResourceApiBaseUrl('ios')).toBe('http://127.0.0.1:8787')
    expect(getDevelopmentResourceApiBaseUrl('android')).toBe('http://10.0.2.2:8787')
    expect(getDevelopmentResourceApiBaseUrl('web')).toBeUndefined()
  })

  it('decodes the shared API contract into the historical Verse boundary', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          resource: { kind: 'bible-text', versionId: 'LSG', revision: 'lsg-r1' },
          book: 1,
          chapter: 1,
          verses: [
            {
              number: 1,
              text: 'Au commencement',
              presentation: { startTags: [], layout: [], notes: [], headings: [] },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const http = createHttpBibleChapterAdapter({
      baseUrl: 'http://127.0.0.1:8787/',
      fetcher,
      isOnline: async () => true,
    })

    await expect(http.loadChapter('LSG', 1, 1)).resolves.toEqual({
      status: 'available',
      presentation: 'canonical',
      verses: [
        {
          Livre: 1,
          Chapitre: 1,
          Verset: 1,
          Texte: 'Au commencement',
          TextRevision: 'lsg-r1',
          StartTags: [],
          Layout: [],
          Notes: [],
          Headings: [],
        },
      ],
    })
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/v1/bibles/LSG/books/1/chapters/1',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    )
  })

  it('decodes remote canon coverage for zero-copy navigation', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          resource: { kind: 'bible-text', versionId: 'LSG', revision: 'lsg-r1' },
          canon: { id: 'protestant-66', orderedBooks: [1] },
          versification: 'bible-strong-default',
          books: [1],
          chaptersByBook: { 1: [1, 2] },
          verseCountByBookChapter: { '1-1': 31, '1-2': 25 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const http = createHttpBibleChapterAdapter({
      baseUrl: 'http://127.0.0.1:8787',
      fetcher,
      isOnline: async () => true,
    })

    await expect(http.loadCoverage('LSG')).resolves.toEqual({
      status: 'available',
      coverage: {
        canon: { id: 'protestant-66', orderedBooks: [1] },
        versification: 'bible-strong-default',
        books: [1],
        chaptersByBook: { 1: [1, 2] },
        verseCountByBookChapter: { '1-1': 31, '1-2': 25 },
      },
    })
  })

  it.each([
    [404, 'BIBLE_CHAPTER_NOT_FOUND', 'chapter-not-available'],
    [404, 'BIBLE_UNSUPPORTED', 'resource-unsupported'],
    [503, 'BIBLE_PUBLICATION_INACTIVE', 'temporary-unavailable'],
    [500, 'RESOURCE_INTERNAL_FAILURE', 'temporary-unavailable'],
  ] as const)('maps HTTP %s/%s to %s', async (status, code, reason) => {
    const http = createHttpBibleChapterAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ code }), {
          status,
          headers: { 'content-type': 'application/json' },
        })
      ),
      isOnline: async () => true,
    })

    await expect(http.loadChapter('LSG', 1, 1)).resolves.toEqual({
      status: 'unavailable',
      reason,
    })
  })

  it('distinguishes offline transport from a temporary online failure', async () => {
    const load = (isOnline: boolean) =>
      createHttpBibleChapterAdapter({
        baseUrl: 'http://localhost:8787',
        fetcher: jest.fn().mockRejectedValue(new TypeError('Network request failed')),
        isOnline: async () => isOnline,
      }).loadChapter('LSG', 1, 1)

    await expect(load(false)).resolves.toEqual({
      status: 'unavailable',
      reason: 'network-offline',
    })
    await expect(load(true)).resolves.toEqual({
      status: 'unavailable',
      reason: 'temporary-unavailable',
    })
  })

  it('reports malformed remote content as an integrity outcome', async () => {
    const http = createHttpBibleChapterAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher: jest.fn().mockResolvedValue(new Response('{}', { status: 200 })),
      isOnline: async () => true,
    })

    await expect(http.loadChapter('LSG', 1, 1)).resolves.toEqual({
      status: 'unavailable',
      reason: 'integrity-failure',
    })
  })
})
