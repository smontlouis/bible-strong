/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({
  biblesRef: {},
  cdnUrl: (path: string) => `https://assets.example/${path}`,
  getDatabaseUrl: jest.fn(),
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    DBY: { id: 'DBY', name: 'Bible Darby' },
    BHG: { id: 'BHG', name: 'Bible hébraïque et grecque' },
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

import {
  createInterlinearSidecarDownloadPlan,
  createStrongSidecarDownloadPlan,
  dedupeDownloadItems,
} from '../downloadItemFactory'

describe('Strong Bible download planning', () => {
  it.each(['base-missing', 'base-incompatible'] as const)(
    'queues the canonical Bible before its sidecar when status is %s',
    status => {
      expect(createStrongSidecarDownloadPlan('DBY', status).map(item => item.id)).toEqual([
        'bible:DBY',
        'bible-strong:DBY',
      ])
      expect(createStrongSidecarDownloadPlan('DBY', status)[1]?.dependsOnId).toBe('bible:DBY')
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

describe('Interlinear Bible download planning', () => {
  it.each(['base-missing', 'base-incompatible'] as const)(
    'queues BHG before its localized index when status is %s',
    status => {
      const plan = createInterlinearSidecarDownloadPlan('fr', status)
      expect(plan.map(item => item.id)).toEqual(['bible:BHG', 'bible-interlinear:BHG:fr'])
      expect(plan[1]?.dependsOnId).toBe('bible:BHG')
    }
  )

  it.each(['missing', 'incompatible', 'corrupt'] as const)(
    'queues only the localized index when BHG is compatible and status is %s',
    status => {
      expect(createInterlinearSidecarDownloadPlan('en', status).map(item => item.id)).toEqual([
        'bible-interlinear:BHG:en',
      ])
    }
  )
})
