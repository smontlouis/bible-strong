import type * as FileSystem from 'expo-file-system/legacy'

import type { DownloadItem } from '~state/downloadQueue'

import { isAtomicResourceFileRollbackError } from './atomicResourceFile'
import { getInterlinearSidecarPath } from './interlinearBibleSidecar'
import { getDownloadItemIdentity } from './offlineCopy'
import { invalidateOfflineCopyQueries } from './offlineCopyQueries'
import { installResourceDatabaseItem } from './resourceDatabaseInstallation'
import {
  beginResourceInstallation,
  commitResourceInstallation,
  completeResourceInstallation,
  rollbackResourceInstallation,
  type ResourceInstallationJournal,
  type ResourceInstallationRecoveryTarget,
} from './resourceInstallationJournal'
import { getStrongBibleSidecarPath } from './strongBibleSidecar'
import { getStrongLexiconModulePath } from './strongLexiconModules'

export interface ManagedResourceInstallationCallbacks {
  onDownloadProgress: (progress: number) => void
  onInsertProgress: (progress: number) => void
  onStatusInserting: () => void
  onResumable: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled: () => boolean
}

const getResourceInstallationRecoveryTarget = (
  item: DownloadItem
): ResourceInstallationRecoveryTarget => {
  switch (item.type) {
    case 'bible':
      return { kind: 'bible-sqlite', versionId: item.versionId }
    case 'database':
      return { kind: 'file', destinationPath: item.destinationPath }
    case 'dictionary':
      return { kind: 'file', destinationPath: item.destinationPath }
    case 'dictionary-directory':
      return { kind: 'file', destinationPath: item.destinationPath }
    case 'commentary':
      return { kind: 'file', destinationPath: item.destinationPath }
    case 'bible-strong-sidecar':
      return { kind: 'file', destinationPath: getStrongBibleSidecarPath(item.versionId) }
    case 'bible-interlinear-sidecar':
      return { kind: 'file', destinationPath: getInterlinearSidecarPath(item.lang) }
    case 'strong-lexicon-module':
      return {
        kind: 'file',
        destinationPath: getStrongLexiconModulePath(item.strongLexiconModuleId),
      }
  }
}

export const installManagedResource = async (
  item: DownloadItem,
  callbacks: ManagedResourceInstallationCallbacks
): Promise<void> => {
  let installationJournal: ResourceInstallationJournal | undefined
  let installationCommitted = false
  let installationCompleted = false
  try {
    await installResourceDatabaseItem(item, {
      ...callbacks,
      installationLifecycle: {
        prepare: (installed, recoveryTarget) => {
          installationJournal = beginResourceInstallation(
            item.id,
            installed,
            recoveryTarget ?? getResourceInstallationRecoveryTarget(item),
            item.expectedArchiveSha256
          )
        },
        commit: () => {
          if (!installationJournal) {
            throw new Error(`RESOURCE_INSTALLATION_NOT_PREPARED:${item.id}`)
          }
          commitResourceInstallation(installationJournal)
          installationCommitted = true
        },
      },
    })
    if (!installationJournal || !installationCommitted) {
      throw new Error(`RESOURCE_PUBLICATION_NOT_COMMITTED:${item.id}`)
    }
    installationCompleted = true
    completeResourceInstallation(installationJournal)
  } catch (error) {
    if (
      installationJournal &&
      !installationCompleted &&
      !isAtomicResourceFileRollbackError(error)
    ) {
      rollbackResourceInstallation(installationJournal)
    }
    throw error
  }

  await invalidateOfflineCopyQueries(getDownloadItemIdentity(item))
}
