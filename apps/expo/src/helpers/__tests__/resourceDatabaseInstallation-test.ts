import * as FileSystem from 'expo-file-system/legacy'

import { installAtomicResourceFile } from '../atomicResourceFile'
import { downloadResourceArtifact } from '../downloadResourceArtifact'
import { installResourceDatabaseItem } from '../resourceDatabaseInstallation'
import { openSQLiteDatabase } from '../sqlite'
import type { CommentaryDownloadItem } from '../offlineCopy'

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}))
jest.mock('react-native-zip-archive', () => ({ unzip: jest.fn() }))
jest.mock('../sqlite', () => ({ openSQLiteDatabase: jest.fn(), dbManager: {} }))
jest.mock('../downloadResourceArtifact', () => ({ downloadResourceArtifact: jest.fn() }))
jest.mock('../atomicResourceFile', () => ({ installAtomicResourceFile: jest.fn() }))
jest.mock('../downloadBibleToSqlite', () => ({}))
jest.mock('../strongBibleSidecar', () => ({}))
jest.mock('../interlinearBibleSidecar', () => ({}))
jest.mock('../strongLexiconModules', () => ({}))
jest.mock('../fileIntegrity', () => ({
  toNativeFilePath: (path: string) => path,
  verifyFileSha256: jest.fn(),
}))

const item: CommentaryDownloadItem = {
  id: 'database:egw-writings:en',
  type: 'commentary',
  resourceId: 'egw-writings',
  name: 'EGW',
  lang: 'en',
  url: 'https://example.com/egw.zip',
  destinationPath: '/documents/egw.sqlite',
  archiveEntry: 'egw.sqlite',
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
  isCancelled: () => false,
  installationLifecycle: { prepare: jest.fn(), commit: jest.fn() },
}
const close = jest.fn()
const getTables = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(downloadResourceArtifact).mockResolvedValue({
    archive: { kind: 'plain', url: 'https://example.com/egw.sqlite.zip', archiveSha256: 'sha' },
  } as Awaited<ReturnType<typeof downloadResourceArtifact>>)
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    isDirectory: false,
    uri: '/documents/egw.sqlite.extract/egw.sqlite',
    size: 10,
    modificationTime: 0,
  })
  jest.mocked(openSQLiteDatabase).mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue({ integrity_check: 'ok' }),
    getAllAsync: getTables,
    closeAsync: close,
  } as unknown as Awaited<ReturnType<typeof openSQLiteDatabase>>)
})

it.each([
  ['legacy', ['COMMENTAIRES']],
  ['normalized EGW', ['COMMENTARY_DOCUMENTS', 'COMMENTARY_VERSE_DOCUMENTS']],
  ['additive', ['COMMENTARY_DOCUMENTS', 'COMMENTARY_VERSE_DOCUMENTS', 'FUTURE_TABLE']],
])('installs a %s commentary database', async (_format, tables) => {
  getTables.mockResolvedValue((tables as string[]).map(name => ({ name })))

  await installResourceDatabaseItem(item, callbacks)

  expect(downloadResourceArtifact).toHaveBeenCalled()
  expect(installAtomicResourceFile).toHaveBeenCalledWith(
    expect.objectContaining({ destinationPath: item.destinationPath })
  )
  expect(close).toHaveBeenCalledTimes(1)
})

it.each([
  ['empty', []],
  ['missing links', ['COMMENTARY_DOCUMENTS']],
  ['missing documents', ['COMMENTARY_VERSE_DOCUMENTS']],
  ['incomplete normalized schema with legacy fallback', ['COMMENTAIRES', 'COMMENTARY_DOCUMENTS']],
])('rejects %s without replacing the installed copy', async (_format, tables) => {
  getTables.mockResolvedValue((tables as string[]).map(name => ({ name })))

  await expect(installResourceDatabaseItem(item, callbacks)).rejects.toThrow(
    'RESOURCE_DATABASE_SCHEMA_MISMATCH:egw-writings:en'
  )

  expect(installAtomicResourceFile).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledTimes(1)
  expect(FileSystem.deleteAsync).toHaveBeenLastCalledWith('/documents/egw.sqlite.extract/', {
    idempotent: true,
  })
})
