/* eslint-disable import/first */

import type { DownloadItem } from '~state/downloadQueue'

const mockInstallResourceDatabaseItem = jest.fn()
const mockBeginResourceInstallation = jest.fn()
const mockCommitResourceInstallation = jest.fn()
const mockCompleteResourceInstallation = jest.fn()
const mockRollbackResourceInstallation = jest.fn()
const mockInvalidateOfflineCopyQueries = jest.fn()
const mockIsAtomicResourceFileRollbackError = jest.fn()

jest.mock('../resourceDatabaseInstallation', () => ({
  installResourceDatabaseItem: (...args: unknown[]) => mockInstallResourceDatabaseItem(...args),
}))

jest.mock('../resourceInstallationJournal', () => ({
  beginResourceInstallation: (...args: unknown[]) => mockBeginResourceInstallation(...args),
  commitResourceInstallation: (...args: unknown[]) => mockCommitResourceInstallation(...args),
  completeResourceInstallation: (...args: unknown[]) => mockCompleteResourceInstallation(...args),
  rollbackResourceInstallation: (...args: unknown[]) => mockRollbackResourceInstallation(...args),
}))

jest.mock('../offlineCopyQueries', () => ({
  invalidateOfflineCopyQueries: (...args: unknown[]) => mockInvalidateOfflineCopyQueries(...args),
}))

jest.mock('../offlineCopy', () => ({
  getDownloadItemIdentity: (item: { databaseId: string; lang: string }) => ({
    kind: 'database',
    databaseId: item.databaseId,
    language: item.lang,
  }),
}))

jest.mock('../atomicResourceFile', () => ({
  isAtomicResourceFileRollbackError: (...args: unknown[]) =>
    mockIsAtomicResourceFileRollbackError(...args),
}))

jest.mock('../strongBibleSidecar', () => ({
  getStrongBibleSidecarPath: (versionId: string) => `/strong/${versionId}.sqlite`,
}))

jest.mock('../interlinearBibleSidecar', () => ({
  getInterlinearSidecarPath: (language: string) => `/interlinear/${language}.sqlite`,
}))

jest.mock('../strongLexiconModules', () => ({
  getStrongLexiconModulePath: (moduleId: string) => `/strong-lexicon/${moduleId}.sqlite`,
}))

jest.mock('../pericopes', () => ({
  requirePericopePath: (versionId: string) => `/pericopes/${versionId}.json`,
}))

jest.mock('../redWords', () => ({
  requireRedWordsPath: (versionId: string) => `/red-words/${versionId}.json`,
}))

import { installManagedResource } from '../managedResourceInstallation'

const databaseItem: DownloadItem = {
  id: 'database:NAVE:fr',
  type: 'database',
  name: 'Nave',
  databaseId: 'NAVE',
  lang: 'fr',
  url: 'https://example.com/nave.sqlite',
  destinationPath: '/documents/SQLite/fr/nave.sqlite',
  archiveEntry: 'nave-fr.sqlite',
  estimatedSize: 10,
  expectedArchiveSha256: 'a'.repeat(64),
  addedAt: 1,
  retryCount: 0,
}

const callbacks = {
  onDownloadProgress: jest.fn(),
  onInsertProgress: jest.fn(),
  onStatusInserting: jest.fn(),
  onResumable: jest.fn(),
  isCancelled: jest.fn(() => false),
}

const installedResource = {
  result: { uri: '/resource.sqlite.download', status: 200, headers: {} },
  publication: { revision: '2', size: 10 },
  sourceUrl: 'https://example.com/nave.sqlite',
}

describe('installManagedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBeginResourceInstallation.mockReturnValue({ id: 'journal' })
    mockIsAtomicResourceFileRollbackError.mockReturnValue(false)
  })

  it('publishes, completes and invalidates a resource through the shared atomic lifecycle', async () => {
    mockInstallResourceDatabaseItem.mockImplementation(async (_item, options) => {
      options.installationLifecycle.prepare(installedResource)
      options.installationLifecycle.commit()
    })

    await installManagedResource(databaseItem, callbacks)

    expect(mockBeginResourceInstallation).toHaveBeenCalledWith(
      databaseItem.id,
      installedResource,
      {
        kind: 'file',
        destinationPath: databaseItem.destinationPath,
      },
      databaseItem.expectedArchiveSha256
    )
    expect(mockCommitResourceInstallation).toHaveBeenCalledWith({ id: 'journal' })
    expect(mockCompleteResourceInstallation).toHaveBeenCalledWith({ id: 'journal' })
    expect(mockRollbackResourceInstallation).not.toHaveBeenCalled()
    expect(mockInvalidateOfflineCopyQueries).toHaveBeenCalledWith({
      kind: 'database',
      databaseId: 'NAVE',
      language: 'fr',
    })
  })

  it('rolls back a prepared resource when installation fails before completion', async () => {
    mockInstallResourceDatabaseItem.mockImplementation(async (_item, options) => {
      options.installationLifecycle.prepare(installedResource)
      throw new Error('download-failed')
    })

    await expect(installManagedResource(databaseItem, callbacks)).rejects.toThrow('download-failed')

    expect(mockRollbackResourceInstallation).toHaveBeenCalledWith({ id: 'journal' })
    expect(mockInvalidateOfflineCopyQueries).not.toHaveBeenCalled()
  })

  it('does not double-rollback an atomic installer failure that already restored the resource', async () => {
    const error = new Error('atomic-rollback')
    mockIsAtomicResourceFileRollbackError.mockImplementation(value => value === error)
    mockInstallResourceDatabaseItem.mockImplementation(async (_item, options) => {
      options.installationLifecycle.prepare(installedResource)
      throw error
    })

    await expect(installManagedResource(databaseItem, callbacks)).rejects.toBe(error)

    expect(mockRollbackResourceInstallation).not.toHaveBeenCalled()
  })

  it('rejects an installer that returns without committing publication metadata', async () => {
    mockInstallResourceDatabaseItem.mockImplementation(async (_item, options) => {
      options.installationLifecycle.prepare(installedResource)
    })

    await expect(installManagedResource(databaseItem, callbacks)).rejects.toThrow(
      `RESOURCE_PUBLICATION_NOT_COMMITTED:${databaseItem.id}`
    )
    expect(mockRollbackResourceInstallation).toHaveBeenCalledWith({ id: 'journal' })
  })
})
