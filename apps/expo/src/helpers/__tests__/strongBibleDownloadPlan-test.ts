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

const mockInstalledArchives = new Map<string, string>()
jest.mock('~helpers/resourcePublication', () => ({
  resourcePublicationStore: {
    read: (resourceId: string) =>
      mockInstalledArchives.has(resourceId)
        ? { archiveSha256: mockInstalledArchives.get(resourceId) }
        : undefined,
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

import {
  completeInterlinearDownloadPlan,
  createInterlinearSidecarDownloadPlan,
  createBibleDownloadItem,
  createDatabaseDownloadItem,
  createOfflineCopyDownloadItem,
  createOfflineCopyDownloadPlan,
  createStrongSidecarDownloadPlan,
  dedupeDownloadItems,
} from '../downloadItemFactory'
import { createStrongModeDownloadPlan } from '../strongModeDownloadPlan'
import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  loadMobileResourceCatalog,
} from '../mobileResourceCatalog'

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
        url: expect.stringMatching(
          /^https:\/\/api\.bible-strong\.app\/v1\/offline-artifacts\/bibles\/bible-ost\.json\.zip\?sha256=[a-f0-9]{64}$/
        ),
        archiveEntry: 'bible-ost.json',
        expectedArchiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
  })

  it('installs the canonical text alone from the Bible archive (ADR-0066)', () => {
    expect(createBibleDownloadItem('NBS')).toEqual(
      expect.objectContaining({
        id: 'bible:NBS',
        archiveEntries: { canonical: 'bible-nbs.json' },
      })
    )
  })

  it.each(['bible-pericope', 'bible-red-words'] as const)(
    'acquires %s by downloading its parent Bible archive',
    kind => {
      expect(
        createOfflineCopyDownloadPlan({ kind, versionId: 'NBS' }).map(item => item.id)
      ).toEqual(['bible:NBS'])
    }
  )
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

  it('acquires the named Strong lexicon with the index, independently of it', () => {
    const plan = createStrongSidecarDownloadPlan('DBY', 'missing', 'simple-fr')

    expect(plan.map(item => item.id)).toEqual(['bible-strong:DBY', 'strong-lexicon:simple-fr'])
    expect(plan[1]?.dependsOnId).toBeUndefined()
  })

  it('keeps the canonical Bible first when the lexicon comes with a missing base', () => {
    expect(
      createOfflineCopyDownloadPlan(
        { kind: 'strong-bible-index', versionId: 'DBY' },
        { availabilityStatus: 'base-missing', strongIndexLexiconModuleId: 'simple-en' }
      ).map(item => item.id)
    ).toEqual(['bible:DBY', 'bible-strong:DBY', 'strong-lexicon:simple-en'])
  })

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
        url: 'https://api.bible-strong.app/v1/offline-artifacts/databases/nave-fr.sqlite.zip',
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
        url: 'https://api.bible-strong.app/v1/offline-artifacts/databases/commentaires-tresor.sqlite.zip',
      })
    )
  })
})

describe('Interlinear Bible download planning', () => {
  const catalogBhg = BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible:BHG']!

  beforeEach(() => {
    mockInstalledArchives.clear()
  })

  it.each(['base-missing', 'base-incompatible'] as const)(
    'queues BHG before its localized index when status is %s',
    status => {
      const plan = createInterlinearSidecarDownloadPlan('fr', status)
      expect(plan.map(item => item.id)).toEqual(['bible:BHG', 'bible-interlinear:BHG:fr'])
      expect(plan[1]?.dependsOnId).toBe('bible:BHG')
    }
  )

  it.each(['missing', 'incompatible', 'corrupt'] as const)(
    'queues only the localized index when the installed BHG is the catalog one and status is %s',
    status => {
      mockInstalledArchives.set('bible:BHG', catalogBhg.archiveSha256)

      const plan = createInterlinearSidecarDownloadPlan('en', status)

      expect(plan.map(item => item.id)).toEqual(['bible-interlinear:BHG:en'])
      expect(plan[0]?.dependsOnId).toBeUndefined()
    }
  )

  it('binds the BHG and localized index downloads to the text the catalog declares', () => {
    const [bible, index] = createInterlinearSidecarDownloadPlan('fr', 'base-missing')

    expect(bible?.type).toBe('bible')
    expect(index?.type).toBe('bible-interlinear-sidecar')
    if (bible?.type !== 'bible' || index?.type !== 'bible-interlinear-sidecar') {
      throw new Error('Expected the BHG Bible followed by its French interlinear index')
    }

    expect(bible.declaredTextIdentity).toEqual({
      textRevision: catalogBhg.textRevision,
      textSha256: catalogBhg.textSha256,
    })
    expect(bible.expectedArchiveSha256).toBe(catalogBhg.archiveSha256)
    expect(index.interlinearArtifact).toMatchObject({
      text: bible.declaredTextIdentity,
      archiveSha256:
        BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible-interlinear:BHG:fr']!.archiveSha256,
    })
  })

  describe('when the catalog publishes another BHG than the installed one', () => {
    const catalogIndex = (language: 'fr' | 'en') =>
      BUNDLED_MOBILE_RESOURCE_CATALOG.resources[`bible-interlinear:BHG:${language}`]!
    const installOlderPair = (...languages: ('fr' | 'en')[]) => {
      mockInstalledArchives.set('bible:BHG', '1'.repeat(64))
      for (const language of languages) {
        mockInstalledArchives.set(`bible-interlinear:BHG:${language}`, '2'.repeat(64))
      }
    }

    it('brings the published text before an index built for it', () => {
      installOlderPair('fr')

      const plan = createInterlinearSidecarDownloadPlan('fr', 'available')

      expect(plan.map(item => item.id)).toEqual(['bible:BHG', 'bible-interlinear:BHG:fr'])
      expect(plan[1]?.dependsOnId).toBe('bible:BHG')
    })

    it('brings every installed index along with the text, and no index nobody installed', () => {
      installOlderPair('fr')

      const plan = createOfflineCopyDownloadPlan({ kind: 'bible', versionId: 'BHG' })

      expect(plan.map(item => item.id)).toEqual(['bible:BHG', 'bible-interlinear:BHG:fr'])
      expect(plan[1]?.dependsOnId).toBe('bible:BHG')
      expect(plan[1]?.expectedArchiveSha256).toBe(catalogIndex('fr').archiveSha256)
    })

    it('updates the other installed language when one index is asked for', () => {
      installOlderPair('fr', 'en')

      const plan = createInterlinearSidecarDownloadPlan('en', 'incompatible')

      expect(plan.map(item => item.id)).toEqual([
        'bible:BHG',
        'bible-interlinear:BHG:en',
        'bible-interlinear:BHG:fr',
      ])
      expect(plan.slice(1).every(item => item.dependsOnId === 'bible:BHG')).toBe(true)
    })

    it('completes a text update asked for without its indexes, whoever asked', () => {
      installOlderPair('fr', 'en')

      const plan = completeInterlinearDownloadPlan([createBibleDownloadItem('BHG')])

      expect(plan.map(item => item.id)).toEqual([
        'bible:BHG',
        'bible-interlinear:BHG:fr',
        'bible-interlinear:BHG:en',
      ])
      // Completing a complete plan changes nothing.
      expect(completeInterlinearDownloadPlan(plan).map(item => item.id)).toEqual(
        plan.map(item => item.id)
      )
    })

    it('only updates the index left behind once the text is the published one', () => {
      mockInstalledArchives.set('bible:BHG', catalogBhg.archiveSha256)
      mockInstalledArchives.set('bible-interlinear:BHG:fr', '2'.repeat(64))

      const plan = createInterlinearSidecarDownloadPlan('fr', 'incompatible')

      expect(plan.map(item => item.id)).toEqual(['bible-interlinear:BHG:fr'])
      expect(plan[0]?.dependsOnId).toBeUndefined()
    })

    it('leaves a text update alone when its indexes are already the published ones', () => {
      mockInstalledArchives.set('bible:BHG', '1'.repeat(64))
      mockInstalledArchives.set('bible-interlinear:BHG:fr', catalogIndex('fr').archiveSha256)

      expect(
        createOfflineCopyDownloadPlan({ kind: 'bible', versionId: 'BHG' }).map(item => item.id)
      ).toEqual(['bible:BHG'])
    })

    it('never touches a plan without BHG', () => {
      installOlderPair('fr', 'en')
      const plan = createOfflineCopyDownloadPlan({ kind: 'bible', versionId: 'DBY' })

      expect(plan.map(item => item.id)).toEqual(['bible:DBY'])
      expect(completeInterlinearDownloadPlan(plan)).toBe(plan)
    })
  })

  it('takes physical index integrity from a newer active mobile catalog', async () => {
    const catalog = structuredClone(BUNDLED_MOBILE_RESOURCE_CATALOG)
    catalog.generatedAt = '2099-01-01T00:00:00.000Z'
    const physical = catalog.resources['bible-interlinear:BHG:fr']!
    physical.archiveSha256 = 'a'.repeat(64)
    physical.archiveBytes = 123456
    physical.contentSha256 = 'b'.repeat(64)
    physical.contentBytes = 654321
    physical.entry = 'bible-step-interlinear-fr-v2.sqlite'
    physical.entries.canonical = {
      entry: physical.entry,
      sha256: physical.contentSha256,
      bytes: physical.contentBytes,
    }
    mockInstalledArchives.set('bible:BHG', catalogBhg.archiveSha256)

    await loadMobileResourceCatalog(
      jest.fn(async () => new Response(JSON.stringify(catalog), { status: 200 })) as typeof fetch
    )
    const [index] = createInterlinearSidecarDownloadPlan('fr', 'missing')
    expect(index?.type).toBe('bible-interlinear-sidecar')
    if (index?.type !== 'bible-interlinear-sidecar') throw new Error('Expected interlinear index')
    expect(index.interlinearArtifact).toMatchObject({
      entry: physical.entry,
      archiveSha256: physical.archiveSha256,
      archiveBytes: physical.archiveBytes,
      contentSha256: physical.contentSha256,
      contentBytes: physical.contentBytes,
      text: { textRevision: catalogBhg.textRevision },
    })
  })
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
