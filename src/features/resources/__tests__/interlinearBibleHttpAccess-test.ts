import {
  createHttpInterlinearBibleResourceAdapter,
  createHybridInterlinearBibleResourceAdapter,
  type InterlinearBibleResourceAdapter,
} from '../interlinearBibleResourceAccess'
import { ResourceAccessError } from '../resourceAccessError'

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

jest.mock('~helpers/interlinearBibleSidecar', () => ({
  getInterlinearSidecarAvailability: jest.fn(),
  loadInterlinearChapterTokens: jest.fn(),
}))

const resource = {
  kind: 'interlinear-index',
  versionId: 'BHG',
  datasetId: 'STEP',
  language: 'fr',
  revision: 'bhg-interlinear-fr-v1',
  textRevision: 'bhg-text-v1',
  textSha256: '1'.repeat(64),
}

const segment = {
  ordinal: 0,
  startOffset: 0,
  length: 8,
  transliteration: 'bereshit',
  lemma: 'רֵאשִׁית',
  morphology: 'HNcfsa',
  gloss: 'commencement',
  identities: [{ kind: 'strong' as const, code: 'H07225' }],
}

const token = {
  id: 7,
  ordinal: 0,
  startOffset: 0,
  length: 8,
  segments: [segment],
}

const jsonResponse = (value: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  )

const unavailableAdapter = (): jest.Mocked<InterlinearBibleResourceAdapter> => ({
  getAvailability: jest.fn().mockResolvedValue({ status: 'missing' }),
  loadChapterTokens: jest.fn(),
})

const bibleChapterAdapter = {
  loadChapter: async () => ({
    status: 'available' as const,
    textRevision: resource.textRevision,
    textSha256: resource.textSha256,
    verses: [
      {
        Livre: 1,
        Chapitre: 1,
        Verset: 1,
        Texte: 'בְּרֵאשִׁית',
        TextRevision: resource.textRevision,
      },
    ],
  }),
  loadCoverage: async () => ({
    status: 'available' as const,
    coverage: {
      canon: { id: 'protestant-66', orderedBooks: [1] },
      versification: 'protestant-66',
      books: [1],
      chaptersByBook: { 1: [1] },
      verseCountByBookChapter: { '1-1': 1 },
    },
    textRevision: resource.textRevision,
    textSha256: resource.textSha256,
  }),
}

describe('interlinear Bible HTTP resource access', () => {
  it('loads an interlinear chapter over HTTP with zero Offline copy', async () => {
    const fetcher = jest.fn((url: string) =>
      url.endsWith('/coverage')
        ? jsonResponse({
            resource,
            books: [1],
            chaptersByBook: { 1: [1] },
            verseCountByBookChapter: { '1-1': 1 },
          })
        : jsonResponse({
            resource,
            book: 1,
            chapter: 1,
            verses: [{ number: 1, tokens: [token] }],
          })
    ) as jest.MockedFunction<typeof fetch>
    const online = createHttpInterlinearBibleResourceAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher,
      isOnline: async () => true,
      bibleChapterAdapter,
    })
    const hybrid = createHybridInterlinearBibleResourceAdapter({
      offline: unavailableAdapter(),
      online,
      remotelyReadableLocales: new Set(['fr', 'en']),
      isOnline: async () => true,
    })

    await expect(hybrid.getAvailability('fr')).resolves.toMatchObject({
      status: 'available',
      locale: 'fr',
    })
    await expect(hybrid.loadChapterTokens('fr', { book: 1, chapter: 1 })).resolves.toEqual({
      tokensByVerse: { 1: [token] },
      textRevision: resource.textRevision,
      textSha256: resource.textSha256,
    })
  })

  it('prefers installed SQLite and returns to HTTP after removal', async () => {
    const offline = unavailableAdapter()
    let installed = true
    offline.getAvailability.mockImplementation(async () =>
      installed
        ? { status: 'available', locale: 'fr', textRevision: resource.textRevision }
        : { status: 'missing' }
    )
    offline.loadChapterTokens.mockResolvedValue({
      tokensByVerse: { 1: [] },
      textRevision: resource.textRevision,
      textSha256: resource.textSha256,
    })
    const online = unavailableAdapter()
    online.getAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: resource.textRevision,
    })
    online.loadChapterTokens.mockResolvedValue({
      tokensByVerse: { 1: [token] },
      textRevision: resource.textRevision,
      textSha256: resource.textSha256,
    })
    const hybrid = createHybridInterlinearBibleResourceAdapter({
      offline,
      online,
      remotelyReadableLocales: new Set(['fr', 'en']),
      isOnline: async () => true,
    })

    await expect(hybrid.loadChapterTokens('fr', { book: 1, chapter: 1 })).resolves.toMatchObject({
      tokensByVerse: { 1: [] },
    })
    installed = false
    await expect(hybrid.loadChapterTokens('fr', { book: 1, chapter: 1 })).resolves.toMatchObject({
      tokensByVerse: { 1: [token] },
    })
  })

  it('recovers from a corrupt index through HTTP and keeps corruption actionable offline', async () => {
    const offline = unavailableAdapter()
    offline.getAvailability.mockResolvedValue({ status: 'corrupt', reason: 'integrity-check' })
    const online = unavailableAdapter()
    online.getAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: resource.textRevision,
    })
    online.loadChapterTokens.mockResolvedValue({
      tokensByVerse: { 1: [token] },
      textRevision: resource.textRevision,
      textSha256: resource.textSha256,
    })
    const hybrid = createHybridInterlinearBibleResourceAdapter({
      offline,
      online,
      remotelyReadableLocales: new Set(['fr', 'en']),
      isOnline: async () => true,
    })

    await expect(hybrid.loadChapterTokens('fr', { book: 1, chapter: 1 })).resolves.toMatchObject({
      tokensByVerse: { 1: [token] },
    })

    const offlineOnly = createHybridInterlinearBibleResourceAdapter({
      offline,
      online,
      remotelyReadableLocales: new Set(['fr', 'en']),
      isOnline: async () => false,
    })
    await expect(offlineOnly.loadChapterTokens('fr', { book: 1, chapter: 1 })).rejects.toEqual(
      new ResourceAccessError('INVALID_OFFLINE_COPY', [
        'acquire-offline-copy',
        'manage-offline-copies',
      ])
    )
  })

  it('keeps an incompatible installed BHG dependency instead of mixing revisions', async () => {
    const offline = unavailableAdapter()
    offline.getAvailability.mockResolvedValue({ status: 'base-incompatible' })
    const online = unavailableAdapter()
    const hybrid = createHybridInterlinearBibleResourceAdapter({
      offline,
      online,
      remotelyReadableLocales: new Set(['fr', 'en']),
      isOnline: async () => true,
    })

    await expect(hybrid.getAvailability('fr')).resolves.toEqual({ status: 'base-incompatible' })
    expect(online.getAvailability).not.toHaveBeenCalled()
  })

  it('maps not-found, temporary, malformed, and offline HTTP responses', async () => {
    const cases = [
      [404, { code: 'INTERLINEAR_CHAPTER_NOT_FOUND' }, 'NOT_FOUND'],
      [503, { code: 'INTERLINEAR_PUBLICATION_INACTIVE' }, 'TEMPORARY_UNAVAILABLE'],
      [200, { resource: {} }, 'INTEGRITY_FAILURE'],
    ] as const

    for (const [status, payload, code] of cases) {
      const adapter = createHttpInterlinearBibleResourceAdapter({
        baseUrl: 'http://localhost:8787',
        fetcher: () => jsonResponse(payload, status),
        isOnline: async () => true,
        bibleChapterAdapter,
      })
      await expect(adapter.loadChapterTokens('fr', { book: 1, chapter: 1 })).rejects.toMatchObject({
        code,
      })
    }

    const offlineAdapter = createHttpInterlinearBibleResourceAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher: async () => {
        throw new TypeError('network')
      },
      isOnline: async () => false,
      bibleChapterAdapter,
    })
    await expect(
      offlineAdapter.loadChapterTokens('fr', { book: 1, chapter: 1 })
    ).rejects.toMatchObject({ code: 'NETWORK_OFFLINE' })
  })
})
