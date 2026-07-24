import * as FileSystem from 'expo-file-system/legacy'

import { downloadAndInsertBible } from '~helpers/downloadBibleToSqlite'
import { downloadWithCdnFallback } from '~helpers/downloadWithCdnFallback'
import { dbManager } from '~helpers/sqlite'
import { downloadRedWordsFile, versionHasRedWords } from '~helpers/redWords'
import { downloadPericopeFile, versionHasPericope } from '~helpers/pericopes'
import type { DatabaseId } from '~helpers/databaseTypes'
import type { DownloadItem } from '~state/downloadQueue'
import { installStrongBibleSidecar } from './strongBibleSidecar'
import type { StrongBibleVersionId } from './strongBiblePublications'
import { installInterlinearSidecar } from './interlinearBibleSidecar'

export interface ResourceInstallationCallbacks {
  onDownloadProgress: (progress: number) => void
  onInsertProgress: (progress: number) => void
  onStatusInserting: () => void
  onResumable: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled: () => boolean
}

const downloadSidecarBibleFiles = (item: DownloadItem, versionId: string) => {
  if (item.hasRedWords && versionHasRedWords(versionId)) {
    downloadRedWordsFile(versionId)
  }
  if (item.hasPericope && versionHasPericope(versionId)) {
    downloadPericopeFile(versionId)
  }
}

const downloadFile = async (item: DownloadItem, callbacks: ResourceInstallationCallbacks) => {
  await downloadWithCdnFallback({
    url: item.url,
    destinationPath: item.destinationPath!,
    onDownloadProgress: ({ totalBytesWritten }) => {
      callbacks.onDownloadProgress(Math.min(totalBytesWritten / item.estimatedSize, 1))
    },
    onResumable: callbacks.onResumable,
    isCancelled: callbacks.isCancelled,
    logTag: 'ResourceInstallation',
  })

  if (callbacks.isCancelled()) throw new Error('CANCELLED')
}

const installBible = async (item: DownloadItem, callbacks: ResourceInstallationCallbacks) => {
  const versionId = item.versionId!

  await downloadAndInsertBible(versionId, item.url, {
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
  downloadSidecarBibleFiles(item, versionId)
}

const installBibleStrong = async (item: DownloadItem, callbacks: ResourceInstallationCallbacks) => {
  await downloadFile(item, callbacks)

  const versionId = item.versionId!
  if (versionId === 'INT' || versionId === 'INT_EN') {
    const lang = versionId === 'INT' ? 'fr' : 'en'
    await dbManager.getDB('INTERLINEAIRE', lang).init()
  }

  downloadSidecarBibleFiles(item, versionId)
}

const installDatabase = async (item: DownloadItem, callbacks: ResourceInstallationCallbacks) => {
  await downloadFile(item, callbacks)

  const dbId = item.databaseId!
  const lang = item.lang || 'fr'
  await dbManager.getDB(dbId as DatabaseId, lang).init()
}

const installBibleStrongSidecar = async (
  item: DownloadItem,
  callbacks: ResourceInstallationCallbacks
) => {
  await installStrongBibleSidecar(item.versionId as StrongBibleVersionId, {
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
  await installInterlinearSidecar(item.lang, item.interlinearArtifact, item.interlinearDatasetId, {
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
) => {
  switch (item.type) {
    case 'bible':
      await installBible(item, callbacks)
      break
    case 'bible-strong':
      await installBibleStrong(item, callbacks)
      break
    case 'bible-strong-sidecar':
      await installBibleStrongSidecar(item, callbacks)
      break
    case 'bible-interlinear-sidecar':
      await installBibleInterlinearSidecar(item, callbacks)
      break
    case 'database':
      await installDatabase(item, callbacks)
      break
  }
}
