import * as FileSystem from 'expo-file-system/legacy'
import { versions, Version } from '~helpers/bibleVersions'
import { resourcePublicationStore } from './resourcePublication'
import { restoreOrphanedResourceBackup } from './atomicResourceFile'
import { createOfflineCopyId } from './offlineCopyId'

export interface BibleResourceConfig {
  label: string
  identityKind: 'bible-pericope' | 'bible-red-words'
  getFileName: (versionId: string) => string
  versionHasFeature: (version: Version) => boolean
}

export interface BibleResourceHelpers {
  getFilePath: (versionId: string) => string
  versionSupported: (versionId: string) => boolean
  hasFile: (versionId: string) => Promise<boolean>
  deleteFile: (versionId: string) => Promise<void>
}

export function createBibleResourceHelpers(config: BibleResourceConfig): BibleResourceHelpers {
  const { label, identityKind, getFileName, versionHasFeature } = config

  function getFilePath(versionId: string): string {
    return `${FileSystem.documentDirectory}${getFileName(versionId)}`
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

  async function deleteFile(versionId: string): Promise<void> {
    try {
      const path = getFilePath(versionId)
      const info = await FileSystem.getInfoAsync(path)
      if (info.exists) {
        await FileSystem.deleteAsync(info.uri)
        console.log(`[${label}] Deleted ${versionId}`)
      }
      resourcePublicationStore.remove(createOfflineCopyId({ kind: identityKind, versionId }))
    } catch (e) {
      console.log(`[${label}] Failed to delete ${versionId}:`, e)
    }
  }

  return { getFilePath, versionSupported, hasFile, deleteFile }
}
