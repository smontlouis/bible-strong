import { getEvents } from '../events.web'

jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: async () => [{ uri: 'https://assets.example/timeline.txt', localUri: null }],
  },
}))
jest.mock('~assets/timeline/events.txt', () => 1)

describe('timeline browser asset', () => {
  afterEach(() => jest.restoreAllMocks())

  it('loads sections from the asset URL without a native local file', async () => {
    const sections = [{ id: 1, events: [] }]
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(sections), { status: 200 }))
    await expect(getEvents()).resolves.toEqual(sections)
    expect(fetcher).toHaveBeenCalledWith('https://assets.example/timeline.txt')
  })

  it('reports unavailable assets instead of treating an error response as sections', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await expect(getEvents()).rejects.toThrow('TIMELINE_ASSET_HTTP_404')
  })
})
