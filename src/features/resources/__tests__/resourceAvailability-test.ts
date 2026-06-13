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

jest.mock('~i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

import {
  getIfLocalResourceNeedsDownload,
  getLocalResourceAvailability,
  isLocalResourceAvailable,
} from '../resourceAvailability'

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
      STRONG: 'strong.sqlite',
      INTERLINEAIRE: 'interlineaire.sqlite',
      NAVE: 'nave.sqlite',
    }

    return `file:///docs/SQLite/${lang}/${fileNameByDb[dbId] ?? `${dbId.toLowerCase()}.sqlite`}`
  }),
  getDocumentDirectory: jest.fn(() => 'file:///docs/'),
  getCurrentResourceLanguage: jest.fn(() => currentLang),
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
        source: 'bibles-sqlite',
      })
    )
  })

  it('falls back to a legacy Bible JSON file', async () => {
    const dependencies = createDependencies({
      files: new Set(['file:///docs/bible-DBY.json']),
    })

    await expect(
      getLocalResourceAvailability({ kind: 'bible', versionId: 'DBY' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'available',
        source: 'legacy-bible-json',
      })
    )
  })

  it('maps interlinear Bible versions to the interlinear resource database', async () => {
    const dependencies = createDependencies({
      files: new Set(['file:///docs/SQLite/fr/interlineaire.sqlite']),
    })

    await expect(
      getLocalResourceAvailability({ kind: 'bible', versionId: 'INT' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'available',
        source: 'database-file',
      })
    )

    expect(dependencies.initLanguageDirs).toHaveBeenCalledWith('fr')
  })

  it('maps Strong Bible versions to the active Strong resource database', async () => {
    const dependencies = createDependencies({
      currentLang: 'en',
      files: new Set(['file:///docs/SQLite/en/strong.sqlite']),
    })

    await expect(
      getLocalResourceAvailability({ kind: 'bible', versionId: 'KJVS' }, dependencies)
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'available',
        source: 'database-file',
      })
    )

    expect(dependencies.initLanguageDirs).toHaveBeenCalledWith('en')
  })

  it('reports missing resources as needing download', async () => {
    const dependencies = createDependencies()

    await expect(
      getIfLocalResourceNeedsDownload(
        { kind: 'database', databaseId: 'NAVE', lang: 'fr' },
        dependencies
      )
    ).resolves.toBe(true)

    await expect(
      getLocalResourceAvailability(
        { kind: 'database', databaseId: 'NAVE', lang: 'fr' },
        dependencies
      )
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'missing',
        expectedPath: 'file:///docs/SQLite/fr/nave.sqlite',
      })
    )
  })
})
