/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({
  biblesRef: {},
  cdnUrl: (path: string) => `https://assets.example/${path}`,
  getDatabaseUrl: jest.fn(),
}))

jest.mock('~helpers/databaseTypes', () => ({
  isSharedDB: (databaseId: string) => databaseId === 'TRESOR',
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    DBY: { id: 'DBY', name: 'Bible Darby' },
    OST: { id: 'OST', name: 'Bible Ostervald' },
    NBS: { id: 'NBS', name: 'Nouvelle Bible Segond', hasRedWords: true, hasPericope: true },
    KJV: {
      id: 'KJV',
      name: 'King James Version',
      hasRedWords: true,
      hasPericope: true,
    },
    BHG: { id: 'BHG', name: 'Bible hébraïque et grecque' },
  },
}))

jest.mock('~helpers/databases', () => ({
  databases: () => ({
    NAVE: { name: 'Nave', fileSize: 1 },
    TRESOR: { name: 'Trésor', fileSize: 1 },
  }),
  getDbPath: (databaseId: string, lang: string) =>
    databaseId === 'TRESOR'
      ? '/documents/SQLite/shared/commentaires-tresor.sqlite'
      : `/documents/SQLite/${lang}/${databaseId.toLowerCase()}.sqlite`,
}))

jest.mock('~helpers/requireBiblePath', () => ({
  requireBiblePath: jest.fn(),
}))

import {
  createInterlinearSidecarDownloadPlan,
  createBibleDownloadItem,
  createDatabaseDownloadItem,
  createOfflineCopyDownloadItem,
  createOfflineCopyDownloadPlan,
  createStrongSidecarDownloadPlan,
  dedupeDownloadItems,
} from '../downloadItemFactory'
import { createStrongModeDownloadPlan } from '../strongModeDownloadPlan'

describe('Strong Bible download planning', () => {
  it('plans a Strong Offline copy from its canonical identity', () => {
    const plan = createOfflineCopyDownloadPlan(
      { kind: 'strong-bible-index', versionId: 'DBY' },
      { availabilityStatus: 'base-missing' }
    )

    expect(plan.map(item => item.id)).toEqual(['bible:DBY', 'bible-strong:DBY'])
    expect(plan[1]?.dependsOnId).toBe('bible:DBY')
  })

  it('describes the requested Offline copy without substituting its dependency', () => {
    expect(
      createOfflineCopyDownloadItem({
        kind: 'strong-bible-index',
        versionId: 'DBY',
      })
    ).toEqual(
      expect.objectContaining({
        id: 'bible-strong:DBY',
        type: 'bible-strong-sidecar',
      })
    )
  })

  it('does not queue legacy red-word or pericope files for a canonical V4 publication', () => {
    expect(createBibleDownloadItem('KJV')).toEqual(
      expect.objectContaining({
        archiveEntries: { canonical: 'bible-kjv.json' },
      })
    )
  })

  it('uses the global ZIP catalog for a historical Bible', () => {
    expect(createBibleDownloadItem('OST')).toEqual(
      expect.objectContaining({
        url: 'https://assets.bible-strong.app/bibles/bible-ost.json.zip',
        archiveEntry: 'bible-ost.json',
        expectedArchiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
  })

  it('installs legacy display metadata from the same Bible archive', () => {
    expect(createBibleDownloadItem('NBS')).toEqual(
      expect.objectContaining({
        id: 'bible:NBS',
        archiveEntries: {
          canonical: 'bible-nbs.json',
          pericope: 'bible-nbs-pericope.json',
          redWords: 'red-words-nbs.json',
        },
      })
    )
  })
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

describe('historical resource database download planning', () => {
  it('uses the global ZIP catalog and declared archive entry', () => {
    expect(createDatabaseDownloadItem('NAVE', 'fr')).toEqual(
      expect.objectContaining({
        url: 'https://assets.bible-strong.app/databases/nave-fr.sqlite.zip',
        archiveEntry: 'nave-fr.sqlite',
        destinationPath: '/documents/SQLite/fr/nave.sqlite',
        expectedArchiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
  })

  it('canonicalizes a shared database to its language-independent catalog identity', () => {
    expect(createDatabaseDownloadItem('TRESOR', 'en')).toEqual(
      expect.objectContaining({
        id: 'database:TRESOR:fr',
        lang: 'fr',
        url: 'https://assets.bible-strong.app/databases/commentaires-tresor.sqlite.zip',
      })
    )
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

describe('Strong display mode download planning', () => {
  it('queues only the missing Strong sidecar for Strong mode', () => {
    const plan = createStrongModeDownloadPlan({
      mode: 'visible',
      versionId: 'DBY',
      strongAvailability: { status: 'missing' },
      interlinearAvailabilities: [],
    })

    expect(plan.items.map(item => item.id)).toEqual(['bible-strong:DBY'])
    expect(plan.preferredInterlinearLocale).toBeUndefined()
  })

  it('queues Strong, BHG, then the localized index for reverse interlinear mode', () => {
    const plan = createStrongModeDownloadPlan({
      mode: 'reverse-interlinear',
      versionId: 'DBY',
      strongAvailability: { status: 'missing' },
      interlinearAvailabilities: [
        { locale: 'fr', availability: { status: 'base-missing' } },
        { locale: 'en', availability: { status: 'base-missing' } },
      ],
    })

    expect(plan.items.map(item => item.id)).toEqual([
      'bible-strong:DBY',
      'bible:BHG',
      'bible-interlinear:BHG:fr',
    ])
    expect(plan.items[2]?.dependsOnId).toBe('bible:BHG')
    expect(plan.preferredInterlinearLocale).toBe('fr')
  })

  it('reuses an installed interlinear index instead of downloading another locale', () => {
    const plan = createStrongModeDownloadPlan({
      mode: 'reverse-interlinear',
      versionId: 'DBY',
      strongAvailability: { status: 'missing' },
      interlinearAvailabilities: [
        { locale: 'fr', availability: { status: 'missing' } },
        {
          locale: 'en',
          availability: {
            status: 'available',
            locale: 'en',
            textRevision: 'bhg-v4',
          },
        },
      ],
    })

    expect(plan.items.map(item => item.id)).toEqual(['bible-strong:DBY'])
    expect(plan.preferredInterlinearLocale).toBe('en')
  })
})
