import * as FileSystem from 'expo-file-system/legacy'

import { downloadAndInsertBible } from '~helpers/downloadBibleToSqlite'
import { downloadWithCdnFallback } from '~helpers/downloadWithCdnFallback'
import { dbManager } from '~helpers/sqlite'
import { downloadRedWordsFile, versionHasRedWords } from '~helpers/redWords'
import { downloadPericopeFile, versionHasPericope } from '~helpers/pericopes'
import type { DatabaseId } from '~helpers/databaseTypes'
import type { DownloadItem } from '~state/downloadQueue'

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
    case 'database':
      await installDatabase(item, callbacks)
      break
  }
}
