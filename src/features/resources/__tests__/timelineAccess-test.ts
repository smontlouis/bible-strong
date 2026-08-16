/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }))
jest.mock('~helpers/databases', () => ({ getDbPath: jest.fn() }))
jest.mock('../resourceAvailability', () => ({ getLocalResourceAvailability: jest.fn() }))

import { createLocalTimelineAccess } from '../timelineAccess'

describe('Timeline Resource access', () => {
  it.each(['fr', 'en'] as const)(
    'loads the %s identity through the adapter when its Offline copy is valid',
    async language => {
      const access = createLocalTimelineAccess({
        getAvailability: async identity => ({ status: 'available', resource: identity }),
        getPath: (_databaseId, currentLanguage) => `/timeline-${currentLanguage}.json`,
        readText: async path => JSON.stringify([{ id: path, title: `Timeline ${language}` }]),
      })

      await expect(access.loadDetails(language)).resolves.toEqual({
        status: 'available',
        details: [{ id: `/timeline-${language}.json`, title: `Timeline ${language}` }],
      })
    }
  )

  it('returns the shared acquisition action when the Offline copy is absent', async () => {
    const access = createLocalTimelineAccess({
      getAvailability: async identity => ({ status: 'missing', resource: identity }),
      getPath: () => '/timeline.json',
      readText: async () => '[]',
    })

    await expect(access.loadDetails('fr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'offline-copy-required',
      recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
    })
  })

  it.each(['not-json', '{}'])(
    'isolates invalid Timeline content behind a structured integrity state',
    async content => {
      const access = createLocalTimelineAccess({
        getAvailability: async identity => ({ status: 'available', resource: identity }),
        getPath: () => '/timeline.json',
        readText: async () => content,
      })

      await expect(access.loadDetails('en')).resolves.toEqual({
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

    await expect(access.loadDetails('fr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'temporary-unavailable',
      recoveries: [],
    })
  })
})
