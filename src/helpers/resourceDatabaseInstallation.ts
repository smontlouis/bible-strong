import * as FileSystem from 'expo-file-system/legacy'

import { downloadAndInsertBible } from '~helpers/downloadBibleToSqlite'
import { downloadWithCdnFallback } from '~helpers/downloadWithCdnFallback'
import { dbManager, openSQLiteDatabase } from '~helpers/sqlite'
import { downloadRedWordsFile, versionHasRedWords } from '~helpers/redWords'
import { downloadPericopeFile, versionHasPericope } from '~helpers/pericopes'
import type { DatabaseId } from '~helpers/databaseTypes'
import type { DownloadItem } from '~state/downloadQueue'
import { installStrongBibleSidecar } from './strongBibleSidecar'
import type { StrongBibleVersionId } from './strongBiblePublications'
import { installInterlinearSidecar } from './interlinearBibleSidecar'
import type { DownloadWithCdnFallbackResult } from './downloadWithCdnFallback'
import { restoreOrphanedResourceBackup } from './atomicResourceFile'
import { installStrongLexiconModule } from './strongLexiconModules'

export interface ResourceInstallationCallbacks {
  onDownloadProgress: (progress: number) => void
  onInsertProgress: (progress: number) => void
  onStatusInserting: () => void
  onResumable: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled: () => boolean
}

const downloadSidecarBibleFiles = async (item: DownloadItem, versionId: string) => {
  const downloads: Promise<boolean>[] = []
  if (item.hasRedWords && versionHasRedWords(versionId)) {
    downloads.push(downloadRedWordsFile(versionId))
  }
  if (item.hasPericope && versionHasPericope(versionId)) {
    downloads.push(downloadPericopeFile(versionId))
  }
  const results = await Promise.all(downloads)
  if (results.some(result => !result)) {
    throw new Error(`BIBLE_SIDECAR_DOWNLOAD_FAILED:${versionId}`)
  }
}

const downloadFile = async (
  item: DownloadItem,
  callbacks: ResourceInstallationCallbacks,
  destinationPath = item.destinationPath!
) => {
  const result = await downloadWithCdnFallback({
    url: item.url,
    destinationPath,
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    isCancelled: callbacks.isCancelled,
    logTag: 'ResourceInstallation',
  })

  if (callbacks.isCancelled()) throw new Error('CANCELLED')
  return result
}

const installBible = async (item: DownloadItem, callbacks: ResourceInstallationCallbacks) => {
  const versionId = item.versionId!

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
  })

  callbacks.onResumable(null)
  await downloadSidecarBibleFiles(item, versionId)
  return result
}

const installBibleStrong = async (item: DownloadItem, callbacks: ResourceInstallationCallbacks) => {
  const versionId = item.versionId!
  const destinationPath = item.destinationPath!
  const temporaryPath = `${destinationPath}.download`
  const backupPath = `${destinationPath}.backup`
  await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
  const result = await downloadFile(item, callbacks, temporaryPath)
  const fileName = temporaryPath.split('/').pop()!
  const directory = temporaryPath.slice(0, -(fileName.length + 1))
  const candidate = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
  try {
    const integrity = await candidate.getFirstAsync<{ integrity_check: string }>(
      'PRAGMA integrity_check'
    )
    if (integrity?.integrity_check !== 'ok') {
      throw new Error(`BIBLE_DATABASE_INTEGRITY_FAILED:${versionId}`)
    }
  } finally {
    await candidate.closeAsync()
  }

  const database =
    versionId === 'INT' || versionId === 'INT_EN'
      ? dbManager.getDB('INTERLINEAIRE', versionId === 'INT' ? 'fr' : 'en')
      : undefined
  await database?.close()
  await restoreOrphanedResourceBackup(destinationPath, backupPath)
  await FileSystem.deleteAsync(backupPath, { idempotent: true })
  const installed = await FileSystem.getInfoAsync(destinationPath)
  if (installed.exists) {
    await FileSystem.moveAsync({ from: destinationPath, to: backupPath })
  }
  try {
    await FileSystem.moveAsync({ from: temporaryPath, to: destinationPath })
    await database?.init()
    await FileSystem.deleteAsync(backupPath, { idempotent: true })
  } catch (error) {
    await FileSystem.deleteAsync(destinationPath, { idempotent: true })
    const backup = await FileSystem.getInfoAsync(backupPath)
    if (backup.exists) {
      await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
      await database?.init()
    }
    throw error
  } finally {
    await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
  }

  await downloadSidecarBibleFiles(item, versionId)
  return result
}

const installDatabase = async (item: DownloadItem, callbacks: ResourceInstallationCallbacks) => {
  const dbId = item.databaseId!
  const lang = item.lang || 'fr'
  const destinationPath = item.destinationPath!
  const temporaryPath = `${destinationPath}.download`
  const backupPath = `${destinationPath}.backup`
  await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
  const result = await downloadFile(item, callbacks, temporaryPath)

  try {
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
        const requiredTables: Partial<Record<DatabaseId, string[]>> = {
          DICTIONNAIRE: ['dictionnaire'],
          NAVE: ['topics', 'verses'],
          TRESOR: ['commentaires'],
          MHY: ['commentaires'],
          INTERLINEAIRE: ['interlineaire'],
        }
        if (
          requiredTables[dbId as DatabaseId]?.some(table => !tableNames.has(table.toLowerCase()))
        ) {
          throw new Error(`RESOURCE_DATABASE_SCHEMA_MISMATCH:${dbId}:${lang}`)
        }
      } finally {
        await candidate.closeAsync()
      }
    }

    const database = dbManager.getDB(dbId as DatabaseId, lang)
    await database.close()
    await restoreOrphanedResourceBackup(destinationPath, backupPath)
    await FileSystem.deleteAsync(backupPath, { idempotent: true })
    const installed = await FileSystem.getInfoAsync(destinationPath)
    if (installed.exists) {
      await FileSystem.moveAsync({ from: destinationPath, to: backupPath })
    }
    try {
      await FileSystem.moveAsync({ from: temporaryPath, to: destinationPath })
      if (dbId !== 'TIMELINE') await database.init()
      await FileSystem.deleteAsync(backupPath, { idempotent: true })
    } catch (error) {
      await FileSystem.deleteAsync(destinationPath, { idempotent: true })
      const backup = await FileSystem.getInfoAsync(backupPath)
      if (backup.exists) {
        await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
        if (dbId !== 'TIMELINE') await database.init()
      }
      throw error
    }
    return result
  } finally {
    await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
  }
}

const installBibleStrongSidecar = async (
  item: DownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  return installStrongBibleSidecar(item.versionId as StrongBibleVersionId, {
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    onStatusInserting: callbacks.onStatusInserting,
    onInsertProgress: callbacks.onInsertProgress,
    isCancelled: callbacks.isCancelled,
  })
}

const installBibleInterlinearSidecar = async (
  item: DownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  if (
    !item.lang ||
    !item.interlinearArtifact ||
    item.interlinearDatasetId !== 'STEP' ||
    item.url !== item.interlinearArtifact.url
  ) {
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
  })
}

const installLexiconModule = async (
  item: DownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  if (
    !item.strongLexiconModuleId ||
    !item.strongLexiconArtifact ||
    item.url !== item.strongLexiconArtifact.url
  ) {
    throw new Error(`INVALID_STRONG_LEXICON_DOWNLOAD_ITEM:${item.id}`)
  }
  return installStrongLexiconModule(item.strongLexiconModuleId, {
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    onStatusInserting: callbacks.onStatusInserting,
    onInsertProgress: callbacks.onInsertProgress,
    isCancelled: callbacks.isCancelled,
  })
}

export const installResourceDatabaseItem = async (
  item: DownloadItem,
  callbacks: ResourceInstallationCallbacks
): Promise<DownloadWithCdnFallbackResult> => {
  switch (item.type) {
    case 'bible':
      return installBible(item, callbacks)
    case 'bible-strong':
      return installBibleStrong(item, callbacks)
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
