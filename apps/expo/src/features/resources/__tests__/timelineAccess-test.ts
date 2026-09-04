/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }))
jest.mock('~helpers/databases', () => ({ getDbPath: jest.fn() }))
jest.mock('../resourceAvailability', () => ({ getLocalResourceAvailability: jest.fn() }))

import {
  createHttpTimelineAccess,
  createHybridTimelineAccess,
  createLocalTimelineAccess,
  type TimelineAccess,
} from '../timelineAccess'

describe('Timeline Resource access', () => {
  it.each(['fr', 'en'] as const)(
    'loads the %s identity through the adapter when its Offline copy is valid',
    async language => {
      const access = createLocalTimelineAccess({
        getAvailability: async identity => ({ status: 'available', resource: identity }),
        getPath: (_databaseId, currentLanguage) => `/timeline-${currentLanguage}.json`,
        readText: async path =>
          JSON.stringify([
            {
              id: path,
              slug: 'creation',
              title: `Timeline ${language}`,
              description: 'Description',
              article: 'Long article',
              period: 'Origins',
              dates: '1',
              related: [],
              images: [],
              videos: [],
              scriptures: [],
            },
          ]),
      })

      await expect(access.loadIndex(language)).resolves.toEqual({
        status: 'available',
        details: [
          {
            id: `/timeline-${language}.json`,
            slug: 'creation',
            title: `Timeline ${language}`,
            description: 'Description',
            period: 'Origins',
            dates: '1',
            images: [],
          },
        ],
      })
    }
  )

  it('returns the shared acquisition action when the Offline copy is absent', async () => {
    const access = createLocalTimelineAccess({
      getAvailability: async identity => ({ status: 'missing', resource: identity }),
      getPath: () => '/timeline.json',
      readText: async () => '[]',
    })

    await expect(access.loadIndex('fr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'offline-copy-required',
      recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
    })
  })

  it('does not cache an unavailable state after an Offline copy is installed', async () => {
    let installed = false
    const access = createLocalTimelineAccess({
      getAvailability: async identity =>
        installed
          ? { status: 'available', resource: identity }
          : { status: 'missing', resource: identity },
      getPath: () => '/timeline.json',
      readText: async () =>
        JSON.stringify([
          {
            id: '1',
            slug: 'creation',
            title: 'Création',
            description: '',
            article: '',
            period: '',
            dates: '',
            related: [],
            images: [],
            videos: [],
            scriptures: [],
          },
        ]),
    })

    await expect(access.loadIndex('fr')).resolves.toMatchObject({ status: 'unavailable' })
    installed = true
    await expect(access.loadIndex('fr')).resolves.toMatchObject({ status: 'available' })
  })

  it('evicts a rejected load so a temporary availability failure can recover', async () => {
    const getAvailability = jest
      .fn()
      .mockRejectedValueOnce(new Error('FILESYSTEM_BUSY'))
      .mockImplementation(async identity => ({ status: 'available' as const, resource: identity }))
    const access = createLocalTimelineAccess({
      getAvailability,
      getPath: () => '/timeline.json',
      readText: async () => '[]',
    })

    await expect(access.loadIndex('fr')).rejects.toThrow('FILESYSTEM_BUSY')
    await expect(access.loadIndex('fr')).resolves.toEqual({ status: 'available', details: [] })
    expect(getAvailability).toHaveBeenCalledTimes(2)
  })

  it('loads one event without exposing the complete catalog contract', async () => {
    const readText = jest.fn(async () =>
      JSON.stringify([
        { id: '1', slug: 'creation', title: 'Création', article: 'Long article' },
        { id: '2', slug: 'exode', title: 'Exode', article: 'Another long article' },
      ])
    )
    const access = createLocalTimelineAccess({
      getAvailability: async identity => ({ status: 'available', resource: identity }),
      getPath: () => '/timeline.json',
      readText,
    })

    await expect(access.loadEvent('fr', 'exode')).resolves.toEqual({
      status: 'available',
      detail: { id: '2', slug: 'exode', title: 'Exode', article: 'Another long article' },
    })
    await access.loadIndex('fr')

    await expect(access.searchIndex('another long', 'fr')).resolves.toMatchObject({
      status: 'available',
      details: [{ slug: 'exode' }],
    })

    expect(readText).toHaveBeenCalledTimes(1)
  })

  it.each(['not-json', '{}'])(
    'isolates invalid Timeline content behind a structured integrity state',
    async content => {
      const access = createLocalTimelineAccess({
        getAvailability: async identity => ({ status: 'available', resource: identity }),
        getPath: () => '/timeline.json',
        readText: async () => content,
      })

      await expect(access.loadIndex('en')).resolves.toEqual({
        status: 'unavailable',
        reason: 'invalid-offline-copy',
        recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
      })
    }
  )

  it('keeps a temporary file read failure distinct from an invalid Offline copy', async () => {
    const access = createLocalTimelineAccess({
      getAvailability: async identity => ({ status: 'available', resource: identity }),
      getPath: () => '/timeline.json',
      readText: async () => {
        throw new Error('DISK_IO')
      },
    })

    await expect(access.loadIndex('fr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'temporary-unavailable',
      recoveries: [],
    })
  })

  it('uses the lightweight index endpoint and loads a full event only on demand', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resource: { kind: 'timeline', language: 'fr', revision: 'r1' },
          events: [
            {
              id: '1',
              slug: 'creation',
              title: 'Création',
              description: 'Description',
              period: 'Origines',
              dates: '1',
              images: [],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resource: { kind: 'timeline', language: 'fr', revision: 'r1' },
          event: {
            id: '1',
            slug: 'creation',
            title: 'Création',
            description: 'Description',
            article: 'Long article',
            period: 'Origines',
            dates: '1',
            related: [],
            images: [],
            videos: [],
            scriptures: [],
          },
        }),
      })
    const access = createHttpTimelineAccess({
      baseUrl: 'https://resources.test',
      fetcher: fetcher as typeof fetch,
      isOnline: async () => true,
    })

    await expect(access.loadIndex('fr')).resolves.toMatchObject({ status: 'available' })
    await expect(access.loadEvent('fr', 'creation')).resolves.toMatchObject({
      status: 'available',
      detail: { slug: 'creation', article: 'Long article' },
    })
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://resources.test/v1/timelines/fr/events',
      'https://resources.test/v1/timelines/fr/events/creation',
    ])
  })
})

describe('hybrid Timeline access', () => {
  it('classifies a missing local copy as offline without calling HTTP', async () => {
    const unavailable = {
      status: 'unavailable' as const,
      reason: 'offline-copy-required' as const,
      recoveries: ['acquire-offline-copy' as const, 'manage-offline-copies' as const],
    }
    const offline: TimelineAccess = {
      getAvailability: jest.fn(async () => unavailable),
      loadIndex: jest.fn(async () => unavailable),
      searchIndex: jest.fn(async () => unavailable),
      loadEvent: jest.fn(async () => unavailable),
    }
    const online: TimelineAccess = {
      loadIndex: jest.fn(),
      searchIndex: jest.fn(),
      loadEvent: jest.fn(),
    }
    const access = createHybridTimelineAccess({
      offline,
      online,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => false,
    })

    await expect(access.loadIndex('fr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'network-offline',
      recoveries: ['retry'],
    })
    expect(online.loadIndex).not.toHaveBeenCalled()
  })
})
