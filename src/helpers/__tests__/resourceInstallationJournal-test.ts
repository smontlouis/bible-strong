/* eslint-disable import/first */

const mockValues = new Map<string, string>()
const mockGetInfoAsync = jest.fn()
const mockMoveAsync = jest.fn()
const mockDeleteAsync = jest.fn()
const mockGetBibleVersionMetadata = jest.fn()

jest.mock('../storage', () => ({
  storage: {
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
    remove: (key: string) => mockValues.delete(key),
  },
}))

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  moveAsync: (...args: unknown[]) => mockMoveAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}))

jest.mock('../biblesDb', () => ({
  getBibleVersionMetadata: (...args: unknown[]) => mockGetBibleVersionMetadata(...args),
}))

import { resourcePublicationStore } from '../resourcePublication'
import {
  beginResourceInstallation,
  commitResourceInstallation,
  reconcileResourceInstallationJournal,
} from '../resourceInstallationJournal'

const previousPublication = {
  generation: '1',
  size: 10,
  sourceUrl: 'https://example.com/old',
  installedAt: 1,
}
const downloadResult = {
  result: {
    uri: '/resource.sqlite.download',
    status: 200,
    headers: {},
    mimeType: 'application/octet-stream',
  },
  publication: { generation: '2', size: 20 },
  sourceUrl: 'https://example.com/new',
}

describe('resource installation journal', () => {
  beforeEach(() => {
    mockValues.clear()
    jest.clearAllMocks()
  })

  it('restores a file backup and its previous publication after an interrupted activation', async () => {
    resourcePublicationStore.write('database:NAVE:fr', previousPublication)
    beginResourceInstallation('database:NAVE:fr', downloadResult, {
      kind: 'file',
      destinationPath: '/resource.sqlite',
    })
    mockGetInfoAsync.mockResolvedValue({ exists: true })

    await reconcileResourceInstallationJournal()

    expect(mockMoveAsync).toHaveBeenCalledWith({
      from: '/resource.sqlite.backup',
      to: '/resource.sqlite',
    })
    expect(resourcePublicationStore.read('database:NAVE:fr')).toEqual(previousPublication)
  })

  it('keeps committed file content and removes its stale backup after restart', async () => {
    const archiveSha256 = 'a'.repeat(64)
    const journal = beginResourceInstallation(
      'database:NAVE:fr',
      downloadResult,
      {
        kind: 'file',
        destinationPath: '/resource.sqlite',
      },
      archiveSha256
    )
    commitResourceInstallation(journal)
    mockGetInfoAsync.mockResolvedValue({ exists: true })

    await reconcileResourceInstallationJournal()

    expect(mockDeleteAsync).toHaveBeenCalledWith('/resource.sqlite.backup', {
      idempotent: true,
    })
    expect(resourcePublicationStore.read('database:NAVE:fr')?.generation).toBe('2')
    expect(resourcePublicationStore.read('database:NAVE:fr')?.archiveSha256).toBe(archiveSha256)
  })

  it('restores an interrupted same-generation reinstall instead of inferring a commit', async () => {
    resourcePublicationStore.write('database:NAVE:fr', {
      ...previousPublication,
      generation: '2',
    })
    beginResourceInstallation('database:NAVE:fr', downloadResult, {
      kind: 'file',
      destinationPath: '/resource.sqlite',
    })
    mockGetInfoAsync.mockResolvedValue({ exists: true })

    await reconcileResourceInstallationJournal()

    expect(mockMoveAsync).toHaveBeenCalledWith({
      from: '/resource.sqlite.backup',
      to: '/resource.sqlite',
    })
    expect(resourcePublicationStore.read('database:NAVE:fr')?.sourceUrl).toBe(
      previousPublication.sourceUrl
    )
  })

  it('keeps the journal when filesystem recovery fails', async () => {
    resourcePublicationStore.write('database:NAVE:fr', previousPublication)
    beginResourceInstallation('database:NAVE:fr', downloadResult, {
      kind: 'file',
      destinationPath: '/resource.sqlite',
    })
    mockGetInfoAsync.mockResolvedValue({ exists: true })
    mockMoveAsync.mockRejectedValueOnce(new Error('restore-failed'))

    await expect(reconcileResourceInstallationJournal()).rejects.toThrow('restore-failed')

    expect(mockValues.has('resource-installation-journal')).toBe(true)
  })

  it('uses the SQLite generation committed with Bible content as the recovery authority', async () => {
    const journal = beginResourceInstallation('bible:DBY', downloadResult, {
      kind: 'bible-sqlite',
      versionId: 'DBY',
    })
    commitResourceInstallation(journal)
    mockGetBibleVersionMetadata.mockResolvedValue({ resourceGeneration: '2' })

    await reconcileResourceInstallationJournal()

    expect(resourcePublicationStore.read('bible:DBY')?.generation).toBe('2')
  })

  it('keeps committed Bible bundle files and removes their recovery backups', async () => {
    const journal = beginResourceInstallation('bible:NBS', downloadResult, {
      kind: 'bible-sqlite',
      versionId: 'NBS',
      bundleFiles: [
        { destinationPath: '/pericope.json', previousCopyExisted: true },
        { destinationPath: '/red-words.json', previousCopyExisted: true },
      ],
    })
    commitResourceInstallation(journal)
    mockGetBibleVersionMetadata.mockResolvedValue({ resourceGeneration: '2' })

    await reconcileResourceInstallationJournal()

    expect(mockDeleteAsync).toHaveBeenCalledWith('/pericope.json.bundle-backup', {
      idempotent: true,
    })
    expect(mockDeleteAsync).toHaveBeenCalledWith('/red-words.json.bundle-backup', {
      idempotent: true,
    })
  })

  it('restores every Bible bundle file when SQLite did not commit', async () => {
    resourcePublicationStore.write('bible:NBS', previousPublication)
    beginResourceInstallation('bible:NBS', downloadResult, {
      kind: 'bible-sqlite',
      versionId: 'NBS',
      bundleFiles: [
        { destinationPath: '/pericope.json', previousCopyExisted: true },
        { destinationPath: '/red-words.json', previousCopyExisted: true },
      ],
    })
    mockGetBibleVersionMetadata.mockResolvedValue({ resourceGeneration: '1' })
    mockGetInfoAsync.mockResolvedValue({ exists: true })

    await reconcileResourceInstallationJournal()

    expect(mockMoveAsync).toHaveBeenCalledWith({
      from: '/pericope.json.bundle-backup',
      to: '/pericope.json',
    })
    expect(mockMoveAsync).toHaveBeenCalledWith({
      from: '/red-words.json.bundle-backup',
      to: '/red-words.json',
    })
    expect(resourcePublicationStore.read('bible:NBS')).toEqual(previousPublication)
  })

  it('leaves old bundle files intact when a crash happens before their activation', async () => {
    resourcePublicationStore.write('bible:NBS', previousPublication)
    beginResourceInstallation('bible:NBS', downloadResult, {
      kind: 'bible-sqlite',
      versionId: 'NBS',
      bundleFiles: [
        { destinationPath: '/pericope.json', previousCopyExisted: true },
        { destinationPath: '/red-words.json', previousCopyExisted: true },
      ],
    })
    mockGetBibleVersionMetadata.mockResolvedValue({ resourceGeneration: '1' })
    mockGetInfoAsync.mockResolvedValue({ exists: false })

    await reconcileResourceInstallationJournal()

    expect(mockDeleteAsync).not.toHaveBeenCalledWith('/pericope.json', { idempotent: true })
    expect(mockDeleteAsync).not.toHaveBeenCalledWith('/red-words.json', { idempotent: true })
  })

  it('restores only the bundle file activated before a partial crash', async () => {
    beginResourceInstallation('bible:NBS', downloadResult, {
      kind: 'bible-sqlite',
      versionId: 'NBS',
      bundleFiles: [
        { destinationPath: '/pericope.json', previousCopyExisted: true },
        { destinationPath: '/red-words.json', previousCopyExisted: true },
      ],
    })
    mockGetBibleVersionMetadata.mockResolvedValue({ resourceGeneration: '1' })
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })

    await reconcileResourceInstallationJournal()

    expect(mockMoveAsync).toHaveBeenCalledWith({
      from: '/pericope.json.bundle-backup',
      to: '/pericope.json',
    })
    expect(mockDeleteAsync).not.toHaveBeenCalledWith('/red-words.json', { idempotent: true })
  })
})
