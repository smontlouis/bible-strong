/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
}))

jest.mock('~helpers/biblesDb', () => ({ isVersionInstalled: jest.fn() }))
jest.mock('~helpers/bibleVersions', () => ({ versions: {} }))
jest.mock('~helpers/databases', () => ({
  getCommentaryDbPath: jest.fn(),
  getDbPath: jest.fn(),
  getDictionaryDbPath: jest.fn(),
  initLanguageDirs: jest.fn(),
}))
jest.mock('~helpers/sqlite', () => ({
  dbManager: { getDB: jest.fn() },
  initSQLiteDir: jest.fn(),
}))
jest.mock('~helpers/strongBibleSidecar', () => ({
  getStrongBibleSidecarAvailability: jest.fn(),
}))
jest.mock('~helpers/interlinearBibleSidecar', () => ({
  getInterlinearSidecarAvailability: jest.fn(),
}))
jest.mock('~helpers/strongLexiconModules', () => ({
  getStrongLexiconModuleAvailability: jest.fn(),
}))
jest.mock('~helpers/resourcePublication', () => ({
  resourcePublicationStore: { read: jest.fn(() => undefined) },
}))
jest.mock('~helpers/pericopes', () => ({ requirePericopePath: jest.fn() }))
jest.mock('~helpers/redWords', () => ({ requireRedWordsPath: jest.fn() }))

import type { MobileResourceCatalog } from '~helpers/mobileResourceCatalog'
import {
  OfflineResourceRegistry,
  type LocalResourceRef,
  type LocalResourceAvailability,
} from '../resourceAvailability'

const sha = (value: string) => value.repeat(64).slice(0, 64)

const catalog = (revision = sha('a')): MobileResourceCatalog => ({
  format: 'bible-strong-mobile-resource-catalog',
  schemaVersion: 1,
  generatedAt: '2026-08-31T00:00:00.000Z',
  resourceCount: 1,
  resources: {
    'database:barnes:fr': {
      id: 'database:barnes:fr',
      url: 'https://example.test/barnes.zip',
      file: 'barnes.zip',
      entry: 'barnes.sqlite',
      entries: {
        canonical: { entry: 'barnes.sqlite', sha256: sha('b'), bytes: 1 },
      },
      archiveSha256: revision,
      archiveBytes: 1,
      contentSha256: sha('b'),
      contentBytes: 1,
      installedBytes: 1,
      peakInstallationBytes: 2,
      strategy: 'archive-extract',
    },
  },
})

const dictionaryCatalog = (revision = sha('d')): MobileResourceCatalog => ({
  format: 'bible-strong-mobile-resource-catalog',
  schemaVersion: 1,
  generatedAt: '2026-08-31T00:00:00.000Z',
  resourceCount: 1,
  resources: {
    'database:BOST:fr': {
      id: 'database:BOST:fr',
      url: 'https://example.test/dictionaries/dictionary-bost-fr.sqlite.zip',
      file: 'dictionaries/dictionary-bost-fr.sqlite.zip',
      entry: 'dictionnaire.sqlite',
      entries: {
        canonical: { entry: 'dictionnaire.sqlite', sha256: sha('e'), bytes: 1 },
      },
      archiveSha256: revision,
      archiveBytes: 1,
      contentSha256: sha('e'),
      contentBytes: 1,
      resourceRevision: `dictionary-bost-fr-${sha('f').slice(0, 20)}`,
      installedBytes: 1,
      peakInstallationBytes: 2,
      strategy: 'archive-extract',
    },
  },
})

describe('OfflineResourceRegistry', () => {
  const identity = {
    kind: 'commentary' as const,
    resourceId: 'barnes',
    language: 'fr' as const,
  }

  it('exposes persisted installation metadata synchronously, then reconciles once', async () => {
    const probe = jest.fn<Promise<LocalResourceAvailability>, [LocalResourceRef]>(
      async resource => ({ status: 'available', resource })
    )
    const registry = new OfflineResourceRegistry({
      probe,
      readPublication: () => ({
        revision: sha('a'),
        archiveSha256: sha('a'),
        installedAt: 1,
        size: 1,
        sourceUrl: 'https://example.test/barnes.zip',
      }),
      getCatalog: () => catalog(),
    })

    expect(registry.isInstalled(identity)).toBe(true)
    expect(registry.get(identity)?.verified).toBe(false)

    const [first, second] = await Promise.all([
      registry.getAvailability(identity),
      registry.getAvailability(identity),
    ])

    expect(first.status).toBe('available')
    expect(second.status).toBe('available')
    expect(probe).toHaveBeenCalledTimes(1)
    expect(registry.get(identity)?.verified).toBe(true)
  })

  it('publishes synchronous updates after installation and removal events', () => {
    const registry = new OfflineResourceRegistry({
      probe: async resource => ({ status: 'missing', resource }),
      readPublication: () => undefined,
      getCatalog: () => catalog(),
    })
    const listener = jest.fn()
    registry.subscribe(listener)

    registry.markInstalled(identity)
    expect(registry.isInstalled(identity)).toBe(true)
    expect(registry.get(identity)?.verified).toBe(false)

    registry.markMissing(identity)
    expect(registry.isInstalled(identity)).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('derives update availability when the active catalog changes', () => {
    let activeCatalog = catalog(sha('a'))
    const registry = new OfflineResourceRegistry({
      probe: async resource => ({ status: 'available', resource }),
      readPublication: () => ({
        revision: sha('a'),
        archiveSha256: sha('a'),
        installedAt: 1,
        size: 1,
        sourceUrl: 'https://example.test/barnes.zip',
      }),
      getCatalog: () => activeCatalog,
    })

    expect(registry.get(identity)?.updateAvailable).toBe(false)
    activeCatalog = catalog(sha('c'))
    registry.syncCatalog(activeCatalog)
    expect(registry.get(identity)?.updateAvailable).toBe(true)
  })

  it('does not keep optimistic availability when physical reconciliation fails', async () => {
    const registry = new OfflineResourceRegistry({
      probe: jest.fn().mockRejectedValue(new Error('filesystem unavailable')),
      readPublication: () => ({
        revision: sha('a'),
        archiveSha256: sha('a'),
        installedAt: 1,
        size: 1,
        sourceUrl: 'https://example.test/barnes.zip',
      }),
      getCatalog: () => catalog(),
    })

    expect(registry.get(identity)?.availability.status).toBe('available')
    expect(registry.get(identity)?.verified).toBe(false)

    await registry.reconcileAll(catalog())

    expect(registry.get(identity)?.availability).toMatchObject({
      status: 'corrupt',
      reason: 'integrity-check-failed',
    })
    expect(registry.get(identity)?.verified).toBe(true)
  })

  it('keeps a downloaded dictionary addressable after catalog reconciliation', async () => {
    const dictionaryIdentity = {
      kind: 'dictionary' as const,
      work: 'bost',
      resourceId: 'BOST',
      language: 'fr' as const,
    }
    const probe = jest.fn<Promise<LocalResourceAvailability>, [LocalResourceRef]>(
      async resource => ({ status: 'available', resource })
    )
    const registry = new OfflineResourceRegistry({
      probe,
      readPublication: resourceId =>
        resourceId === 'dictionary:bost:BOST:fr'
          ? {
              revision: sha('d'),
              archiveSha256: sha('d'),
              installedAt: 1,
              size: 1,
              sourceUrl: 'https://example.test/dictionaries/dictionary-bost-fr.sqlite.zip',
            }
          : undefined,
      getCatalog: () => dictionaryCatalog(),
    })

    expect(registry.get(dictionaryIdentity)?.resource).toEqual(dictionaryIdentity)
    expect(registry.isInstalled(dictionaryIdentity)).toBe(true)

    await registry.reconcileAll(dictionaryCatalog())

    expect(registry.get(dictionaryIdentity)?.availability.status).toBe('available')
    expect(registry.get(dictionaryIdentity)?.catalogRevision).toBe(sha('d'))
    expect(registry.get(dictionaryIdentity)?.updateAvailable).toBe(false)
    expect(probe).toHaveBeenCalledWith(dictionaryIdentity)
  })
})
