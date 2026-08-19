import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import { downloadAndInsertBible } from '~helpers/downloadBibleToSqlite'
import { downloadResourceArtifact } from '~helpers/downloadResourceArtifact'
import { dbManager, openSQLiteDatabase } from '~helpers/sqlite'
import type { DatabaseId } from '~helpers/databaseTypes'
import { resourceDatabaseRequiredTables } from '~helpers/resourceDatabaseSchema'
import type { DownloadItem } from '~state/downloadQueue'
import type {
  BibleDownloadItem,
  DatabaseDownloadItem,
  InterlinearIndexDownloadItem,
  StrongBibleIndexDownloadItem,
  StrongLexiconModuleDownloadItem,
} from './offlineCopy'
import { installStrongBibleSidecar } from './strongBibleSidecar'
import type { StrongBibleVersionId } from './strongBiblePublications'
import { installInterlinearSidecar } from './interlinearBibleSidecar'
import type { DownloadResourceArtifactResult } from './downloadResourceArtifact'
import { installAtomicResourceFile } from './atomicResourceFile'
import { installStrongLexiconModule } from './strongLexiconModules'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'
import { toNativeFilePath, verifyFileSha256 } from './fileIntegrity'

export interface ResourceInstallationCallbacks {
  onDownloadProgress: (progress: number) => void
  onInsertProgress: (progress: number) => void
  onStatusInserting: () => void
  onResumable: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled: () => boolean
  installationLifecycle: ResourceInstallationLifecycle
}

const downloadFile = async (
  item: DatabaseDownloadItem,
  callbacks: ResourceInstallationCallbacks,
  destinationPath = item.destinationPath!
) => {
  const result = await downloadResourceArtifact({
    url: item.url,
    archiveSha256: item.expectedArchiveSha256,
    destinationPath,
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    isCancelled: callbacks.isCancelled,
  })

  if (callbacks.isCancelled()) throw new Error('CANCELLED')
  return result
}

const installBible = async (item: BibleDownloadItem, callbacks: ResourceInstallationCallbacks) => {
  const versionId = item.versionId

  const result = await downloadAndInsertBible(versionId, item.url, {
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    onInsertProgress: progress => {
      callbacks.onStatusInserting()
      callbacks.onInsertProgress(progress)
    },
    isCancelled: callbacks.isCancelled,
    canonicalArtifact: item.canonicalArtifact,
    archiveArtifact: item.archiveArtifact,
    archiveEntry: item.archiveEntry,
    archiveEntries: item.archiveEntries,
    expectedArchiveSha256: item.expectedArchiveSha256,
    installationLifecycle: callbacks.installationLifecycle,
  })

  callbacks.onResumable(null)
  return result
}

const installDatabase = async (
  item: DatabaseDownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  const dbId = item.databaseId
  const lang = item.lang
  const destinationPath = item.destinationPath
  const archivePath = `${destinationPath}.download.zip`
  const extractionDirectory = `${destinationPath}.extract/`
  await FileSystem.deleteAsync(archivePath, { idempotent: true })
  await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  try {
    const result = await downloadFile(item, callbacks, archivePath)
    if (item.expectedArchiveSha256) {
      await verifyFileSha256(
        archivePath,
        item.expectedArchiveSha256,
        `RESOURCE_DATABASE_ARCHIVE_CHECKSUM_MISMATCH:${dbId}:${lang}`
      )
    }
    await callbacks.installationLifecycle.prepare(result)

    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
    await unzip(toNativeFilePath(archivePath), toNativeFilePath(extractionDirectory), 'UTF-8')
    const temporaryPath = `${extractionDirectory}${item.archiveEntry}`
    const extractedInfo = await FileSystem.getInfoAsync(temporaryPath)
    if (!extractedInfo.exists || extractedInfo.isDirectory) {
      throw new Error(`RESOURCE_DATABASE_ARCHIVE_ENTRY_MISSING:${dbId}:${lang}`)
    }
    if (dbId === 'TIMELINE') {
      const timeline = JSON.parse(await FileSystem.readAsStringAsync(temporaryPath)) as unknown
      if (
        !Array.isArray(timeline) ||
        timeline.some(
          event =>
            typeof event !== 'object' ||
            event === null ||
            !('slug' in event) ||
            typeof event.slug !== 'string'
        )
      ) {
        throw new Error(`RESOURCE_DATABASE_SCHEMA_MISMATCH:${dbId}:${lang}`)
      }
    } else {
      const fileName = temporaryPath.split('/').pop()!
      const directory = temporaryPath.slice(0, -(fileName.length + 1))
      const candidate = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
      try {
        const integrity = await candidate.getFirstAsync<{ integrity_check: string }>(
          'PRAGMA integrity_check'
        )
        if (integrity?.integrity_check !== 'ok') {
          throw new Error(`RESOURCE_DATABASE_INTEGRITY_FAILED:${dbId}:${lang}`)
        }
        const tables = await candidate.getAllAsync<{ name: string }>(
          `SELECT name FROM sqlite_schema WHERE type='table'`
        )
        const tableNames = new Set(tables.map(table => table.name.toLowerCase()))
        if (
          resourceDatabaseRequiredTables[dbId as DatabaseId]?.some(
            table => !tableNames.has(table.toLowerCase())
          )
        ) {
          throw new Error(`RESOURCE_DATABASE_SCHEMA_MISMATCH:${dbId}:${lang}`)
        }
      } finally {
        await candidate.closeAsync()
      }
    }

    const database = dbManager.getDB(dbId as DatabaseId, lang)
    await installAtomicResourceFile({
      candidatePath: temporaryPath,
      destinationPath,
      beforeSwap: () => database.close(),
      afterSwap: async () => {
        if (dbId !== 'TIMELINE') await database.init()
        await callbacks.installationLifecycle.commit(result)
      },
      beforeRollback: () => database.close(),
      afterRollback: restored => (restored && dbId !== 'TIMELINE' ? database.init() : undefined),
    })
    return result
  } finally {
    await FileSystem.deleteAsync(archivePath, { idempotent: true })
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  }
}

const installBibleStrongSidecar = async (
  item: StrongBibleIndexDownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  return installStrongBibleSidecar(item.versionId as StrongBibleVersionId, item.strongArtifact, {
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    onStatusInserting: callbacks.onStatusInserting,
    onInsertProgress: callbacks.onInsertProgress,
    isCancelled: callbacks.isCancelled,
    installationLifecycle: callbacks.installationLifecycle,
  })
}

const installBibleInterlinearSidecar = async (
  item: InterlinearIndexDownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  if (item.interlinearDatasetId !== 'STEP' || item.url !== item.interlinearArtifact.url) {
    throw new Error(`INVALID_INTERLINEAR_DOWNLOAD_ITEM:${item.id}`)
  }
  return installInterlinearSidecar(item.lang, item.interlinearArtifact, item.interlinearDatasetId, {
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    onStatusInserting: callbacks.onStatusInserting,
    onInsertProgress: callbacks.onInsertProgress,
    isCancelled: callbacks.isCancelled,
    installationLifecycle: callbacks.installationLifecycle,
  })
}

const installLexiconModule = async (
  item: StrongLexiconModuleDownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  if (item.url !== item.strongLexiconArtifact.url) {
    throw new Error(`INVALID_STRONG_LEXICON_DOWNLOAD_ITEM:${item.id}`)
  }
  return installStrongLexiconModule(item.strongLexiconModuleId, item.strongLexiconArtifact, {
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    onStatusInserting: callbacks.onStatusInserting,
    onInsertProgress: callbacks.onInsertProgress,
    isCancelled: callbacks.isCancelled,
    installationLifecycle: callbacks.installationLifecycle,
  })
}

export const installResourceDatabaseItem = async (
  item: DownloadItem,
  callbacks: ResourceInstallationCallbacks
): Promise<DownloadResourceArtifactResult> => {
  switch (item.type) {
    case 'bible':
      return installBible(item, callbacks)
    case 'bible-strong-sidecar':
      return installBibleStrongSidecar(item, callbacks)
    case 'bible-interlinear-sidecar':
      return installBibleInterlinearSidecar(item, callbacks)
    case 'strong-lexicon-module':
      return installLexiconModule(item, callbacks)
    case 'database':
      return installDatabase(item, callbacks)
  }
}
