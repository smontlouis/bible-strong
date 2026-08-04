import * as FileSystem from 'expo-file-system/legacy'

import { downloadAndInsertBible } from '~helpers/downloadBibleToSqlite'
import { downloadWithCdnFallback } from '~helpers/downloadWithCdnFallback'
import { dbManager, openSQLiteDatabase } from '~helpers/sqlite'
import { downloadRedWordsFile, versionHasRedWords } from '~helpers/redWords'
import { downloadPericopeFile, versionHasPericope } from '~helpers/pericopes'
import type { DatabaseId } from '~helpers/databaseTypes'
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
import type { DownloadWithCdnFallbackResult } from './downloadWithCdnFallback'
import { installAtomicResourceFile } from './atomicResourceFile'
import { installStrongLexiconModule } from './strongLexiconModules'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'

export interface ResourceInstallationCallbacks {
  onDownloadProgress: (progress: number) => void
  onInsertProgress: (progress: number) => void
  onStatusInserting: () => void
  onResumable: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled: () => boolean
  installationLifecycle: ResourceInstallationLifecycle
}

export const synchronizeOptionalBibleResources = async (
  item: BibleDownloadItem,
  versionId: string
) => {
  const downloads: (() => Promise<boolean>)[] = []
  if (item.hasRedWords && versionHasRedWords(versionId)) {
    downloads.push(() => downloadRedWordsFile(versionId))
  }
  if (item.hasPericope && versionHasPericope(versionId)) {
    downloads.push(() => downloadPericopeFile(versionId))
  }
  // The durable installation journal is intentionally single-writer.
  const results = await downloads.reduce<Promise<PromiseSettledResult<boolean>[]>>(
    (previous, download) =>
      previous.then(settled =>
        download().then(
          value => [...settled, { status: 'fulfilled' as const, value }],
          reason => [...settled, { status: 'rejected' as const, reason }]
        )
      ),
    Promise.resolve([])
  )
  if (
    results.some(
      result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value)
    )
  ) {
    console.warn(
      `[ResourceInstallation] Optional Bible resources could not all be refreshed: ${versionId}`
    )
  }
}

const downloadFile = async (
  item: DatabaseDownloadItem,
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
  const temporaryPath = `${destinationPath}.download`
  await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
  const result = await downloadFile(item, callbacks, temporaryPath)
  await callbacks.installationLifecycle.prepare(result)

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
    await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
  }
}

const installBibleStrongSidecar = async (
  item: StrongBibleIndexDownloadItem,
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
  return installStrongLexiconModule(item.strongLexiconModuleId, {
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
): Promise<DownloadWithCdnFallbackResult> => {
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
