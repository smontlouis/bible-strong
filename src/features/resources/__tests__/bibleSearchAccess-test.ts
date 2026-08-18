import { createHttpBibleSearchAccess } from '../bibleSearchAccess'

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
})
