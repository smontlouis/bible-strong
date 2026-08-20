import {
  createHttpStrongBibleResourceAdapter,
  createHybridStrongBibleResourceAdapter,
  createStrongBibleResourceAccess,
  type StrongBibleResourceAdapter,
} from '../strongBibleResourceAccess'
import { ResourceAccessError } from '../resourceAccessError'

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

jest.mock('~helpers/biblesDb', () => ({
  getMultipleVerses: jest.fn(),
  getVerseText: jest.fn(),
}))

jest.mock('~helpers/strongBibleSidecar', () => ({
  getStrongBibleSidecarAvailability: jest.fn(),
  getResolvedStrongBibleConcordanceIdentity: jest.fn(),
  loadStrongBibleLemmaStats: jest.fn(),
  loadStrongBibleLemmaStatsResult: jest.fn(),
  loadStrongBibleChapterSpans: jest.fn(),
  loadStrongBibleOccurrenceLocations: jest.fn(),
  loadStrongBibleVerseCountsByBook: jest.fn(),
  loadStrongBibleVerseCountsByBookResult: jest.fn(),
  loadStrongBibleVerseSpans: jest.fn(),
  loadStrongBibleVersesSpans: jest.fn(),
}))

const resource = {
  kind: 'strong-bible-index',
  versionId: 'LSG',
  datasetId: 'LSG',
  revision: 'strong-publication-v1',
  textRevision: 'lsg-text-v1',
  textSha256: '1'.repeat(64),
  strongRevision: 'strong-content-v1',
}
const span = {
  ordinal: 0,
  startOffset: 0,
  length: 4,
  stepTokenIds: [7],
  identities: [{ kind: 'strong' as const, code: 'H0430' }],
}

const jsonResponse = (value: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  )

const unavailableAdapter = (): jest.Mocked<StrongBibleResourceAdapter> => ({
  getAvailability: jest.fn().mockResolvedValue({ status: 'missing' }),
  loadChapterSpans: jest.fn(),
  loadVerse: jest.fn(),
  loadCountsByBook: jest.fn(),
  loadFoundVersesByBook: jest.fn(),
  loadLemmaStats: jest.fn(),
})

describe('Strong Bible HTTP resource access', () => {
  it('renders Strong from HTTP when no Offline copy exists', async () => {
    const fetcher = jest.fn((url: string) => {
      if (url.endsWith('/coverage')) {
        return jsonResponse({
          resource,
          books: [1],
          chaptersByBook: { 1: [1] },
          verseCountByBookChapter: { '1-1': 1 },
        })
      }
      return jsonResponse({
        resource,
        book: 1,
        chapter: 1,
        verses: [{ number: 1, spans: [span] }],
      })
    }) as jest.MockedFunction<typeof fetch>
    const online = createHttpStrongBibleResourceAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher,
      isOnline: async () => true,
      bibleChapterAdapter: {
        loadChapter: async () => ({
          status: 'available',
          textRevision: resource.textRevision,
          textSha256: resource.textSha256,
          verses: [
            {
              Livre: 1,
              Chapitre: 1,
              Verset: 1,
              Texte: 'Dieu créa',
              TextRevision: 'lsg-text-v1',
            },
          ],
        }),
        loadCoverage: async () => ({
          status: 'available',
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
      },
    })
    const hybrid = createHybridStrongBibleResourceAdapter({
      offline: unavailableAdapter(),
      online,
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => true,
    })
    const access = createStrongBibleResourceAccess(hybrid)

    await expect(access.getAvailability('LSG')).resolves.toMatchObject({
      status: 'available',
      versionId: 'LSG',
    })
    await expect(
      access.loadVerse({
        currentVersionId: 'LSG',
        defaultVersionId: 'LSG',
        book: 1,
        chapter: 1,
        verse: 1,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'available',
        verse: expect.objectContaining({ Texte: 'Dieu créa', StrongSpans: [span] }),
      })
    )
  })

  it('prefers installed SQLite, then returns to HTTP after that copy is removed', async () => {
    const offline = unavailableAdapter()
    let installed = true
    offline.getAvailability.mockImplementation(async () =>
      installed
        ? {
            status: 'available',
            versionId: 'LSG',
            datasetId: 'LSG',
            textRevision: 'lsg-text-v1',
            strongRevision: 'strong-content-v1',
          }
        : { status: 'missing' }
    )
    offline.loadChapterSpans.mockResolvedValue({ spansByVerse: { 1: [] } })
    const online = unavailableAdapter()
    online.getAvailability.mockResolvedValue({
      status: 'available',
      versionId: 'LSG',
      datasetId: 'LSG',
      textRevision: 'lsg-text-v1',
      strongRevision: 'strong-content-v1',
    })
    online.loadChapterSpans.mockResolvedValue({ spansByVerse: { 1: [span] } })
    const hybrid = createHybridStrongBibleResourceAdapter({
      offline,
      online,
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => true,
    })

    await expect(hybrid.loadChapterSpans('LSG', { book: 1, chapter: 1 })).resolves.toEqual({
      spansByVerse: { 1: [] },
    })
    expect(online.loadChapterSpans).not.toHaveBeenCalled()

    installed = false
    await expect(hybrid.loadChapterSpans('LSG', { book: 1, chapter: 1 })).resolves.toEqual({
      spansByVerse: { 1: [span] },
    })
  })

  it('recovers from a corrupt local copy through HTTP without requiring a new download', async () => {
    const offline = unavailableAdapter()
    offline.getAvailability.mockResolvedValue({
      status: 'corrupt',
      reason: 'metadata-invalid',
    })
    const online = unavailableAdapter()
    online.getAvailability.mockResolvedValue({
      status: 'available',
      versionId: 'LSG',
      datasetId: 'LSG',
      textRevision: 'lsg-text-v1',
      strongRevision: 'strong-content-v1',
    })
    online.loadChapterSpans.mockResolvedValue({ spansByVerse: { 1: [span] } })
    const hybrid = createHybridStrongBibleResourceAdapter({
      offline,
      online,
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => true,
    })

    await expect(hybrid.getAvailability('LSG')).resolves.toMatchObject({ status: 'available' })
    await expect(hybrid.loadChapterSpans('LSG', { book: 1, chapter: 1 })).resolves.toEqual({
      spansByVerse: { 1: [span] },
    })
  })

  it('reports malformed HTTP publications as integrity failures', async () => {
    const fetcher: typeof fetch = () => jsonResponse({ resource: {} })
    const online = createHttpStrongBibleResourceAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher,
      isOnline: async () => true,
      bibleChapterAdapter: {
        loadChapter: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
        loadCoverage: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
      },
    })

    await expect(online.getAvailability('LSG')).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE',
    })
  })

  it('reports a stale installed Bible as base-incompatible before Strong activation', async () => {
    const fetcher: typeof fetch = () =>
      jsonResponse({
        resource,
        books: [1],
        chaptersByBook: { 1: [1] },
        verseCountByBookChapter: { '1-1': 1 },
      })
    const online = createHttpStrongBibleResourceAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher,
      isOnline: async () => true,
      bibleChapterAdapter: {
        loadChapter: async () => ({ status: 'unavailable', reason: 'chapter-not-available' }),
        loadCoverage: async () => ({
          status: 'available',
          coverage: {
            canon: { id: 'protestant-66', orderedBooks: [1] },
            versification: 'protestant-66',
            books: [1],
            chaptersByBook: { 1: [1] },
            verseCountByBookChapter: { '1-1': 1 },
          },
          textRevision: 'stale-local-revision',
          textSha256: '0'.repeat(64),
        }),
      },
    })

    await expect(online.getAvailability('LSG')).resolves.toEqual({
      status: 'base-incompatible',
      baseTextRevision: 'stale-local-revision',
      requiredTextRevision: resource.textRevision,
    })
  })

  it('returns the exact Bible dependency from the same HTTP Strong chapter response', async () => {
    const fetcher: typeof fetch = () =>
      jsonResponse({
        resource,
        book: 1,
        chapter: 1,
        verses: [{ number: 1, spans: [span] }],
      })
    const loadBibleChapter = jest.fn().mockResolvedValue({
      status: 'available',
      verses: [],
    })
    const online = createHttpStrongBibleResourceAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher,
      isOnline: async () => true,
      bibleChapterAdapter: {
        loadChapter: loadBibleChapter,
        loadCoverage: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
      },
    })

    await expect(online.loadChapterSpans('LSG', { book: 1, chapter: 1 })).resolves.toEqual({
      spansByVerse: { 1: [span] },
      textRevision: resource.textRevision,
      textSha256: resource.textSha256,
    })
    expect(loadBibleChapter).not.toHaveBeenCalled()
  })

  it('preserves an unavailable Bible source error instead of reporting a missing verse', async () => {
    const fetcher: typeof fetch = () =>
      jsonResponse({
        resource,
        book: 1,
        chapter: 1,
        verses: [{ number: 1, spans: [span] }],
      })
    const online = createHttpStrongBibleResourceAdapter({
      baseUrl: 'http://localhost:8787',
      fetcher,
      isOnline: async () => false,
      bibleChapterAdapter: {
        loadChapter: async () => ({ status: 'unavailable', reason: 'network-offline' }),
        loadCoverage: async () => ({ status: 'unavailable', reason: 'network-offline' }),
      },
    })

    await expect(online.loadVerse('LSG', { book: 1, chapter: 1, verse: 1 })).rejects.toMatchObject({
      code: 'NETWORK_OFFLINE',
    })
  })

  it('keeps an absent copy unavailable while offline without attempting HTTP', async () => {
    const offline = unavailableAdapter()
    const online = unavailableAdapter()
    const hybrid = createHybridStrongBibleResourceAdapter({
      offline,
      online,
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => false,
    })

    await expect(hybrid.getAvailability('LSG')).resolves.toEqual({ status: 'missing' })
    expect(online.getAvailability).not.toHaveBeenCalled()
  })

  it('preserves an incompatible installed Bible instead of advertising remote Strong', async () => {
    const offline = unavailableAdapter()
    offline.getAvailability.mockResolvedValue({
      status: 'base-incompatible',
      baseTextRevision: 'stale-local-revision',
      requiredTextRevision: 'lsg-text-v1',
    })
    const online = unavailableAdapter()
    online.getAvailability.mockResolvedValue({
      status: 'available',
      versionId: 'LSG',
      datasetId: 'LSG',
      textRevision: 'lsg-text-v1',
      strongRevision: 'strong-content-v1',
    })
    const hybrid = createHybridStrongBibleResourceAdapter({
      offline,
      online,
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => true,
    })

    await expect(hybrid.getAvailability('LSG')).resolves.toMatchObject({
      status: 'base-incompatible',
    })
    expect(online.getAvailability).not.toHaveBeenCalled()
  })

  it('keeps corrupt Offline state distinct when HTTP fallback cannot run', async () => {
    const offline = unavailableAdapter()
    offline.getAvailability.mockResolvedValue({ status: 'corrupt', reason: 'metadata-invalid' })
    const hybrid = createHybridStrongBibleResourceAdapter({
      offline,
      online: unavailableAdapter(),
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => false,
    })

    await expect(hybrid.loadChapterSpans('LSG', { book: 1, chapter: 1 })).rejects.toMatchObject({
      code: 'INVALID_OFFLINE_COPY',
      recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
    })
  })

  it('does not continue to another index after a preferred availability failure', async () => {
    const adapter = unavailableAdapter()
    adapter.getAvailability.mockImplementation(async versionId => {
      if (versionId === 'LSG') throw new ResourceAccessError('TEMPORARY_UNAVAILABLE')
      if (versionId === 'DBY') {
        return {
          status: 'available',
          versionId: 'DBY',
          datasetId: 'DBY',
          textRevision: 'dby-text-v1',
          strongRevision: 'dby-strong-v1',
        }
      }
      return { status: 'missing' }
    })
    adapter.loadChapterSpans.mockResolvedValue({ spansByVerse: { 1: [] } })
    const access = createStrongBibleResourceAccess(adapter)

    await expect(
      access.loadChapterSpans({
        currentVersionId: 'LSG',
        defaultVersionId: 'DBY',
        fallbackVersionIds: [],
        book: 1,
        chapter: 1,
      })
    ).rejects.toMatchObject({ code: 'TEMPORARY_UNAVAILABLE' })
    expect(adapter.getAvailability).toHaveBeenCalledTimes(1)
    expect(adapter.loadChapterSpans).not.toHaveBeenCalled()
  })
})
