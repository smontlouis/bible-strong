import * as FileSystem from 'expo-file-system/legacy'

import { cdnUrl } from '~helpers/firebase'
import { versions, Version } from '~helpers/bibleVersions'
import { downloadWithCdnFallback } from './downloadWithCdnFallback'
import { resourcePublicationStore } from './resourcePublication'
import { queryClient } from './queryClient'
import {
  installAtomicResourceFile,
  isAtomicResourceFileRollbackError,
  restoreOrphanedResourceBackup,
} from './atomicResourceFile'
import { createOfflineCopyId } from './offlineCopyId'
import {
  beginResourceInstallation,
  commitResourceInstallation,
  completeResourceInstallation,
  rollbackResourceInstallation,
} from './resourceInstallationJournal'

export interface BibleResourceConfig {
  label: string
  identityKind: 'bible-pericope' | 'bible-red-words'
  getFileName: (versionId: string) => string
  getCdnPath: (versionId: string) => string
  versionHasFeature: (version: Version) => boolean
  validate: (value: unknown) => void
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
  const { label, identityKind, getFileName, getCdnPath, versionHasFeature, validate } = config

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
      console.log(`[${label}] Downloading ${url} to ${path}`)
      await FileSystem.deleteAsync(temporaryPath, { idempotent: true })
      const downloaded = await downloadWithCdnFallback({
        url,
        destinationPath: temporaryPath,
        downloadOptions: { cache: false },
        logTag: label,
      })
      validate(JSON.parse(await FileSystem.readAsStringAsync(temporaryPath)) as unknown)
      try {
        const resourceId = createOfflineCopyId({ kind: identityKind, versionId })
        const journal = beginResourceInstallation(resourceId, downloaded, {
          kind: 'file',
          destinationPath: path,
        })
        let activationCompleted = false
        try {
          await installAtomicResourceFile({
            candidatePath: temporaryPath,
            destinationPath: path,
            afterSwap: () => commitResourceInstallation(journal),
          })
          activationCompleted = true
          completeResourceInstallation(journal)
        } catch (error) {
          if (!activationCompleted && !isAtomicResourceFileRollbackError(error)) {
            rollbackResourceInstallation(journal)
          }
          throw error
        }
        await queryClient.invalidateQueries({
          queryKey: ['resource-publication', resourceId],
        })
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
      resourcePublicationStore.remove(createOfflineCopyId({ kind: identityKind, versionId }))
    } catch (e) {
      console.log(`[${label}] Failed to delete ${versionId}:`, e)
    }
  }

  return { getFilePath, getFileUrl, versionSupported, hasFile, downloadFile, deleteFile }
}
