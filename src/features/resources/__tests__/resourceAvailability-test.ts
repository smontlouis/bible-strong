/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
}))

jest.mock('~helpers/biblesDb', () => ({
  isVersionInstalled: jest.fn(),
}))

jest.mock('~helpers/databases', () => ({
  getDbPath: jest.fn(),
  initLanguageDirs: jest.fn(),
}))

jest.mock('~helpers/sqlite', () => ({
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

jest.mock('~i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

import {
  getIfLocalResourceNeedsDownload,
  getLocalResourceAvailability,
  isLocalResourceAvailable,
} from '../resourceAvailability'
import type { StrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import type { InterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'

const createDependencies = ({
  files = new Set<string>(),
  installedVersions = new Set<string>(),
  currentLang = 'fr',
}: {
  files?: Set<string>
  installedVersions?: Set<string>
  currentLang?: 'fr' | 'en'
} = {}) => ({
  getFileInfo: jest.fn(async (path: string) => ({ exists: files.has(path) })),
  initSQLiteDir: jest.fn(async () => true),
  initLanguageDirs: jest.fn(async () => true),
  isVersionInstalled: jest.fn(async (versionId: string) => installedVersions.has(versionId)),
  getDbPath: jest.fn((dbId: string, lang: string) => {
    const fileNameByDb: Record<string, string> = {
      NAVE: 'nave.sqlite',
    }

    return `file:///docs/SQLite/${lang}/${fileNameByDb[dbId] ?? `${dbId.toLowerCase()}.sqlite`}`
  }),
  getCurrentResourceLanguage: jest.fn(() => currentLang),
  getStrongBibleAvailability: jest.fn(
    async (): Promise<StrongBibleSidecarAvailability> => ({ status: 'missing' })
  ),
  getInterlinearAvailability: jest.fn(
    async (): Promise<InterlinearSidecarAvailability> => ({ status: 'missing' })
  ),
  getStrongLexiconAvailability: jest.fn(
    async (moduleId): Promise<StrongLexiconModuleAvailability> => ({
      status: 'missing',
      moduleId,
    })
  ),
  validateDatabaseResource: jest.fn(async () => true),
})

describe('resourceAvailability', () => {
  it('reports a regular Bible version available from bibles.sqlite', async () => {
    const dependencies = createDependencies({
      installedVersions: new Set(['LSG']),
    })

    await expect(
      isLocalResourceAvailable({ kind: 'bible', versionId: 'LSG' }, dependencies)
    ).resolves.toBe(true)

    await expect(
      getLocalResourceAvailability({ kind: 'bible', versionId: 'LSG' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'available',
      })
    )
  })

  it('does not report a legacy JSON as readable before its SQLite migration succeeds', async () => {
    const dependencies = createDependencies({
      files: new Set(['file:///docs/bible-DBY.json']),
    })

    await expect(
      getLocalResourceAvailability({ kind: 'bible', versionId: 'DBY' }, dependencies)
    ).resolves.toEqual({
      status: 'missing',
      resource: { kind: 'bible', versionId: 'DBY' },
    })
  })

  it('reports missing resources as needing download', async () => {
    const dependencies = createDependencies()

    await expect(
      getIfLocalResourceNeedsDownload(
        { kind: 'database', databaseId: 'NAVE', language: 'fr' },
        dependencies
      )
    ).resolves.toBe(true)

    await expect(
      getLocalResourceAvailability(
        { kind: 'database', databaseId: 'NAVE', language: 'fr' },
        dependencies
      )
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'missing',
        expectedPath: 'file:///docs/SQLite/fr/nave.sqlite',
      })
    )
  })

  it('preserves a failed health check as a corrupt database copy', async () => {
    const path = 'file:///docs/SQLite/fr/nave.sqlite'
    const dependencies = createDependencies({ files: new Set([path]) })
    dependencies.validateDatabaseResource.mockResolvedValue(false)

    await expect(
      getLocalResourceAvailability(
        { kind: 'database', databaseId: 'NAVE', language: 'fr' },
        dependencies
      )
    ).resolves.toEqual({
      status: 'corrupt',
      resource: { kind: 'database', databaseId: 'NAVE', language: 'fr' },
      reason: 'integrity-check-failed',
    })
  })

  it('uses canonical child identities for pericope and red-word availability', async () => {
    const dependencies = createDependencies({
      files: new Set(['file:///docs/bible-dby-pericope.json', 'file:///docs/red-words-DBY.json']),
    })

    await expect(
      isLocalResourceAvailable({ kind: 'bible-pericope', versionId: 'DBY' }, dependencies)
    ).resolves.toBe(true)
    await expect(
      isLocalResourceAvailable({ kind: 'bible-red-words', versionId: 'DBY' }, dependencies)
    ).resolves.toBe(true)
  })

  it('routes every canonical index and lexicon identity through availability', async () => {
    const dependencies = createDependencies()
    dependencies.getStrongBibleAvailability.mockResolvedValue({
      status: 'available',
      versionId: 'DBY',
      datasetId: 'STEP',
      textRevision: 'db-1',
      strongRevision: 'strong-1',
    })
    dependencies.getInterlinearAvailability.mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-1',
    })
    dependencies.getStrongLexiconAvailability.mockResolvedValue({
      status: 'available',
      moduleId: 'core',
      revision: 'lexicon-1',
      schemaVersion: 1,
    })

    await expect(
      getLocalResourceAvailability({ kind: 'strong-bible-index', versionId: 'DBY' }, dependencies)
    ).resolves.toEqual(expect.objectContaining({ status: 'available' }))
    await expect(
      getLocalResourceAvailability(
        { kind: 'interlinear-index', versionId: 'BHG', language: 'fr' },
        dependencies
      )
    ).resolves.toEqual(expect.objectContaining({ status: 'available' }))
    await expect(
      getLocalResourceAvailability(
        { kind: 'strong-lexicon-module', moduleId: 'core' },
        dependencies
      )
    ).resolves.toEqual(expect.objectContaining({ status: 'available' }))
  })

  it('preserves incompatibility and corruption reasons from specialized resources', async () => {
    const dependencies = createDependencies()
    dependencies.getStrongBibleAvailability.mockResolvedValue({
      status: 'incompatible',
      baseTextRevision: 'db-2',
      sidecarTextRevision: 'db-1',
    })
    dependencies.getInterlinearAvailability.mockResolvedValue({
      status: 'corrupt',
      reason: 'integrity-check-failed',
    })

    await expect(
      getLocalResourceAvailability({ kind: 'strong-bible-index', versionId: 'DBY' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'incompatible',
        baseTextRevision: 'db-2',
        sidecarTextRevision: 'db-1',
      })
    )
    await expect(
      getLocalResourceAvailability(
        { kind: 'interlinear-index', versionId: 'BHG', language: 'fr' },
        dependencies
      )
    ).resolves.toEqual(
      expect.objectContaining({ status: 'corrupt', reason: 'integrity-check-failed' })
    )
  })
})
