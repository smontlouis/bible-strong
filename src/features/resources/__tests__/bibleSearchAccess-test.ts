import {
  createHttpBibleSearchAccess,
  createHybridBibleSearchAccess,
  type BibleSearchAccess,
} from '../bibleSearchAccess'
import { ResourceAccessError } from '../resourceAccessError'

jest.mock('~helpers/biblesDb', () => ({
  getInstalledVersions: jest.fn(),
  searchVerses: jest.fn(),
  searchVersesCount: jest.fn(),
}))

describe('HTTP Bible search access', () => {
  it('returns results and their total from one public page request', async () => {
    const fetcher = jest.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            resource: {
              kind: 'bible-text',
              versionId: 'LSG',
              revision: 'r1',
              textRevision: 'r1',
            },
            results: [
              {
                version: 'LSG',
                book: 43,
                chapter: 3,
                verse: 16,
                text: 'Car Dieu a tant aimé le monde',
                highlighted: 'Car Dieu a tant {{aimé}} le monde',
              },
            ],
            count: 12,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    )
    const access = createHttpBibleSearchAccess({
      baseUrl: 'http://resource.test/',
      versions: ['LSG'],
      fetcher,
      isOnline: async () => true,
    })

    await expect(
      access.searchPage('aimé', { version: 'LSG', limit: 5, offset: 10 })
    ).resolves.toMatchObject({
      count: 12,
      results: [{ book: 43, chapter: 3, verse: 16 }],
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      'http://resource.test/v1/bibles/LSG/search?q=aim%C3%A9&limit=5&offset=10',
      expect.any(Object)
    )
  })

  it('rejects a multi-version search when any requested version fails', async () => {
    const fetcher = jest.fn(async (url: string | URL | Request) => {
      const value = String(url)
      if (value.includes('/LSG/')) {
        return new Response(
          JSON.stringify({
            resource: {
              kind: 'bible-text',
              versionId: 'LSG',
              revision: 'r1',
              textRevision: 'r1',
            },
            results: [],
            count: 0,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(JSON.stringify({ code: 'RESOURCE_RATE_LIMITED' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '60',
          'x-request-id': 'request-123',
        },
      })
    })
    const access = createHttpBibleSearchAccess({
      baseUrl: 'http://resource.test/',
      versions: ['LSG', 'DBY'],
      fetcher,
      isOnline: async () => true,
    })

    await expect(access.searchPage('grâce')).rejects.toMatchObject({
      code: 'TEMPORARY_UNAVAILABLE',
      httpStatus: 429,
      requestId: 'request-123',
      retryAfterSeconds: 60,
      serverCode: 'RESOURCE_RATE_LIMITED',
    })
  })
})

describe('hybrid Bible search access', () => {
  it('does not replace a failed connected search with a smaller Offline corpus', async () => {
    const onlineError = new ResourceAccessError('TEMPORARY_UNAVAILABLE')
    const online = {
      getInstalledVersions: jest.fn(),
      searchPage: jest.fn().mockRejectedValue(onlineError),
      searchVerses: jest.fn(),
      searchVersesCount: jest.fn(),
    } satisfies BibleSearchAccess
    const offline = {
      getInstalledVersions: jest.fn().mockResolvedValue(['LSG']),
      searchPage: jest.fn().mockResolvedValue({ results: [], count: 0 }),
      searchVerses: jest.fn(),
      searchVersesCount: jest.fn(),
    } satisfies BibleSearchAccess
    const access = createHybridBibleSearchAccess({
      offline,
      online,
      remotelyReadableVersions: new Set(['LSG', 'DBY']),
      isOnline: async () => true,
    })

    await expect(access.searchPage('grâce')).rejects.toBe(onlineError)
    expect(offline.searchPage).not.toHaveBeenCalled()
  })

  it('selects Offline before loading an explicitly installed non-Online version', async () => {
    const online = {
      getInstalledVersions: jest.fn(),
      searchPage: jest.fn(),
      searchVerses: jest.fn(),
      searchVersesCount: jest.fn(),
    } satisfies BibleSearchAccess
    const offline = {
      getInstalledVersions: jest.fn().mockResolvedValue(['LOCAL']),
      searchPage: jest.fn().mockResolvedValue({ results: [], count: 0 }),
      searchVerses: jest.fn(),
      searchVersesCount: jest.fn(),
    } satisfies BibleSearchAccess
    const access = createHybridBibleSearchAccess({
      offline,
      online,
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => true,
    })

    await expect(access.searchPage('grâce', { version: 'LOCAL' })).resolves.toEqual({
      results: [],
      count: 0,
    })
    expect(offline.searchPage).toHaveBeenCalledWith('grâce', { version: 'LOCAL' })
    expect(online.searchPage).not.toHaveBeenCalled()
  })
})
