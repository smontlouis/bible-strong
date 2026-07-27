import * as FileSystem from 'expo-file-system/legacy'

import { cdnUrl } from '~helpers/firebase'
import { versions, Version } from '~helpers/bibleVersions'
import { downloadWithCdnFallback } from './downloadWithCdnFallback'
import { resourcePublicationStore } from './resourcePublication'
import { queryClient } from './queryClient'
import { restoreOrphanedResourceBackup } from './atomicResourceFile'

export interface BibleResourceConfig {
  label: string
  resourceIdPrefix: string
  getFileName: (versionId: string) => string
  getCdnPath: (versionId: string) => string
  versionHasFeature: (version: Version) => boolean
}

export interface BibleResourceHelpers {
  getFilePath: (versionId: string) => string
  getFileUrl: (versionId: string) => string
  versionSupported: (versionId: string) => boolean
  hasFile: (versionId: string) => Promise<boolean>
  downloadFile: (versionId: string) => Promise<boolean>
  deleteFile: (versionId: string) => Promise<void>
}

export function createBibleResourceHelpers(config: BibleResourceConfig): BibleResourceHelpers {
  const { label, resourceIdPrefix, getFileName, getCdnPath, versionHasFeature } = config

  function getFilePath(versionId: string): string {
    return `${FileSystem.documentDirectory}${getFileName(versionId)}`
  }

  function getFileUrl(versionId: string): string {
    return cdnUrl(getCdnPath(versionId))
  }

  function versionSupported(versionId: string): boolean {
    const version = (versions as Record<string, Version>)[versionId]
    return !!version && versionHasFeature(version)
  }

  async function hasFile(versionId: string): Promise<boolean> {
    const path = getFilePath(versionId)
    await restoreOrphanedResourceBackup(path, `${path}.backup`)
    const info = await FileSystem.getInfoAsync(path)
    return info.exists
  }

  async function downloadFile(versionId: string): Promise<boolean> {
    try {
      const url = getFileUrl(versionId)
      const path = getFilePath(versionId)
      const temporaryPath = `${path}.download`
      const backupPath = `${path}.backup`
      console.log(`[${label}] Downloading ${url} to ${path}`)
      await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
      const downloaded = await downloadWithCdnFallback({
        url,
        destinationPath: temporaryPath,
        downloadOptions: { cache: false },
        logTag: label,
      })
      JSON.parse(await FileSystem.readAsStringAsync(temporaryPath))
      await restoreOrphanedResourceBackup(path, backupPath)
      await FileSystem.deleteAsync(backupPath, { idempotent: true })
      const current = await FileSystem.getInfoAsync(path)
      if (current.exists) await FileSystem.moveAsync({ from: path, to: backupPath })
      try {
        await FileSystem.moveAsync({ from: temporaryPath, to: path })
        resourcePublicationStore.write(`${resourceIdPrefix}:${versionId}`, {
          ...downloaded.publication,
          sourceUrl: downloaded.sourceUrl,
          installedAt: Date.now(),
        })
        await queryClient.invalidateQueries({
          queryKey: ['resource-publication', `${resourceIdPrefix}:${versionId}`],
        })
        await FileSystem.deleteAsync(backupPath, { idempotent: true })
      } catch (error) {
        await FileSystem.deleteAsync(path, { idempotent: true })
        const backup = await FileSystem.getInfoAsync(backupPath)
        if (backup.exists) await FileSystem.moveAsync({ from: backupPath, to: path })
        throw error
      } finally {
        await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
      }
      console.log(`[${label}] Downloaded ${versionId}`)
      return true
    } catch (e) {
      console.log(`[${label}] Failed to download ${versionId}:`, e)
      return false
    }
  }

  async function deleteFile(versionId: string): Promise<void> {
    try {
      const path = getFilePath(versionId)
      const info = await FileSystem.getInfoAsync(path)
      if (info.exists) {
        await FileSystem.deleteAsync(info.uri)
        console.log(`[${label}] Deleted ${versionId}`)
      }
      resourcePublicationStore.remove(`${resourceIdPrefix}:${versionId}`)
    } catch (e) {
      console.log(`[${label}] Failed to delete ${versionId}:`, e)
    }
  }

  return { getFilePath, getFileUrl, versionSupported, hasFile, downloadFile, deleteFile }
}
