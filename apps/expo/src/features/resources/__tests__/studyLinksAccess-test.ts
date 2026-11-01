import { createHttpStudyLinksAccess, createHybridStudyLinksAccess } from '../studyLinksAccess'

const answer = {
  kind: 'nave',
  key: 'love',
  language: 'fr',
  revision: 'study-links-1',
  links: [{ kind: 'dictionary', key: 'bost:1', label: 'Amour', detail: 'Bost' }],
}

describe('study links access', () => {
  it('reads a subject whose key needs escaping', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify(answer)))
    const access = createHttpStudyLinksAccess({
      baseUrl: 'https://api.test/',
      fetcher: fetcher as unknown as typeof fetch,
    })
    const links = await access.load({ kind: 'nave', key: 'age, old' }, 'fr')
    expect(links).toEqual(answer.links)
    expect((fetcher.mock.calls as unknown as string[][])[0][0]).toBe(
      'https://api.test/v1/study-links/nave/age%2C%20old?language=fr'
    )
  })

  it('leaves the section out when the service does not answer', async () => {
    const access = createHttpStudyLinksAccess({
      baseUrl: 'https://api.test',
      fetcher: (async () => {
        throw new Error('offline')
      }) as unknown as typeof fetch,
    })
    await expect(access.load({ kind: 'nave', key: 'love' }, 'fr')).resolves.toEqual([])
  })

  it('reads the offline copy first and falls back on the service', async () => {
    const online = { load: jest.fn(async () => []) }
    const offline = {
      load: jest.fn(async () => {
        throw new Error('corrupt')
      }),
    }
    const access = createHybridStudyLinksAccess({
      offline,
      online,
      isInstalled: async () => true,
    })
    await access.load({ kind: 'nave', key: 'love' }, 'fr')
    expect(offline.load).toHaveBeenCalled()
    expect(online.load).toHaveBeenCalled()
  })
})
