import * as FileSystem from 'expo-file-system/legacy'

import { cdnUrl } from '~helpers/firebase'
import { versions, Version } from '~helpers/bibleVersions'

export interface BibleResourceConfig {
  label: string
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
  const { label, getFileName, getCdnPath, versionHasFeature } = config

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
    const info = await FileSystem.getInfoAsync(path)
    return info.exists
  }

  async function downloadFile(versionId: string): Promise<boolean> {
    try {
      const url = getFileUrl(versionId)
      const path = getFilePath(versionId)
      console.log(`[${label}] Downloading ${url} to ${path}`)
      await FileSystem.downloadAsync(url, path)
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
    } catch (e) {
      console.log(`[${label}] Failed to delete ${versionId}:`, e)
    }
  }

  return { getFilePath, getFileUrl, versionSupported, hasFile, downloadFile, deleteFile }
}
