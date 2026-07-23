/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({
  biblesRef: {},
  cdnUrl: (path: string) => `https://assets.example/${path}`,
  getDatabaseUrl: jest.fn(),
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    DBY: { id: 'DBY', name: 'Bible Darby' },
  },
  isStrongVersion: () => false,
}))

jest.mock('~helpers/databases', () => ({
  databases: () => ({}),
  getDbPath: jest.fn(),
}))

jest.mock('~helpers/requireBiblePath', () => ({
  requireBiblePath: jest.fn(),
}))

import { createStrongSidecarDownloadPlan, dedupeDownloadItems } from '../downloadItemFactory'

describe('Strong Bible download planning', () => {
  it.each(['base-missing', 'base-incompatible'] as const)(
    'queues the canonical Bible before its sidecar when status is %s',
    status => {
      expect(createStrongSidecarDownloadPlan('DBY', status).map(item => item.id)).toEqual([
        'bible:DBY',
        'bible-strong:DBY',
      ])
    }
  )

  it.each(['missing', 'incompatible'] as const)(
    'queues only the sidecar when its base is compatible and status is %s',
    status => {
      expect(createStrongSidecarDownloadPlan('DBY', status).map(item => item.id)).toEqual([
        'bible-strong:DBY',
      ])
    }
  )

  it('deduplicates a base selected explicitly and added as a sidecar dependency', () => {
    const plan = createStrongSidecarDownloadPlan('DBY', 'base-missing')
    expect(dedupeDownloadItems([plan[0]!, ...plan]).map(item => item.id)).toEqual([
      'bible:DBY',
      'bible-strong:DBY',
    ])
  })
})
