import * as FileSystem from 'expo-file-system/legacy'

import { getBibleVersionMetadata } from './biblesDb'
import type { DownloadResourceArtifactResult } from './downloadResourceArtifact'
import { resourcePublicationStore, type InstalledResourcePublication } from './resourcePublication'
import { storage } from './storage'

const JOURNAL_KEY = 'resource-installation-journal'

export type ResourceInstallationRecoveryTarget =
  | { kind: 'file'; destinationPath: string }
  | {
      kind: 'bible-sqlite'
      versionId: string
      bundleFiles?: { destinationPath: string; previousCopyExisted: boolean }[]
    }

export type ResourceInstallationJournal = {
  resourceId: string
  phase: 'prepared' | 'committed'
  previousPublication?: InstalledResourcePublication
  nextPublication: InstalledResourcePublication
  recoveryTarget: ResourceInstallationRecoveryTarget
  startedAt: number
}

const readJournal = (): ResourceInstallationJournal | undefined => {
  const value = storage.getString(JOURNAL_KEY)
  if (!value) return undefined
  try {
    const journal = JSON.parse(value) as ResourceInstallationJournal
    return {
      ...journal,
      // Journals written before phases were introduced always represent the
      // conservative, pre-commit state.
      phase: journal.phase === 'committed' ? 'committed' : 'prepared',
    }
  } catch {
    storage.remove(JOURNAL_KEY)
    return undefined
  }
}

const restorePublication = (journal: ResourceInstallationJournal) => {
  if (journal.previousPublication) {
    resourcePublicationStore.write(journal.resourceId, journal.previousPublication)
  } else {
    resourcePublicationStore.remove(journal.resourceId)
  }
}

export const beginResourceInstallation = (
  resourceId: string,
  result: DownloadResourceArtifactResult,
  recoveryTarget: ResourceInstallationRecoveryTarget,
  archiveSha256?: string
): ResourceInstallationJournal => {
  if (readJournal()) throw new Error('RESOURCE_INSTALLATION_RECOVERY_REQUIRED')
  const journal: ResourceInstallationJournal = {
    resourceId,
    phase: 'prepared',
    previousPublication: resourcePublicationStore.read(resourceId),
    nextPublication: {
      ...result.publication,
      sourceUrl: result.sourceUrl,
      installedAt: Date.now(),
      ...(archiveSha256 ? { archiveSha256 } : {}),
    },
    recoveryTarget,
    startedAt: Date.now(),
  }
  storage.set(JOURNAL_KEY, JSON.stringify(journal))
  return journal
}

export const commitResourceInstallation = (journal: ResourceInstallationJournal): void => {
  resourcePublicationStore.write(journal.resourceId, journal.nextPublication)
  journal.phase = 'committed'
  storage.set(JOURNAL_KEY, JSON.stringify(journal))
}

export const rollbackResourceInstallation = (journal: ResourceInstallationJournal): void => {
  restorePublication(journal)
  storage.remove(JOURNAL_KEY)
}

export const completeResourceInstallation = (journal: ResourceInstallationJournal): void => {
  storage.remove(JOURNAL_KEY)
}

const reconcileFileInstallation = async (journal: ResourceInstallationJournal) => {
  if (journal.recoveryTarget.kind !== 'file') return
  const { destinationPath } = journal.recoveryTarget
  const backupPath = `${destinationPath}.backup`
  const backup = await FileSystem.getInfoAsync(backupPath)

  if (journal.phase === 'committed') {
    resourcePublicationStore.write(journal.resourceId, journal.nextPublication)
    await FileSystem.deleteAsync(backupPath, { idempotent: true })
    return
  }

  if (backup.exists) {
    await FileSystem.deleteAsync(destinationPath, { idempotent: true })
    await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
  } else if (!journal.previousPublication) {
    await FileSystem.deleteAsync(destinationPath, { idempotent: true })
  }
  restorePublication(journal)
}

const reconcileBibleInstallation = async (journal: ResourceInstallationJournal) => {
  if (journal.recoveryTarget.kind !== 'bible-sqlite') return
  const metadata = await getBibleVersionMetadata(journal.recoveryTarget.versionId)
  if (metadata?.resourceGeneration === journal.nextPublication.revision) {
    resourcePublicationStore.write(journal.resourceId, journal.nextPublication)
    await Promise.all(
      (journal.recoveryTarget.bundleFiles ?? []).map(file =>
        FileSystem.deleteAsync(`${file.destinationPath}.bundle-backup`, { idempotent: true })
      )
    )
  } else {
    for (const file of journal.recoveryTarget.bundleFiles ?? []) {
      const { destinationPath, previousCopyExisted } = file
      const backupPath = `${destinationPath}.bundle-backup`
      const backup = await FileSystem.getInfoAsync(backupPath)
      if (backup.exists) {
        await FileSystem.deleteAsync(destinationPath, { idempotent: true })
        await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
      } else if (!previousCopyExisted) {
        await FileSystem.deleteAsync(destinationPath, { idempotent: true })
      }
    }
    restorePublication(journal)
  }
}

export const reconcileResourceInstallationJournal = async (): Promise<void> => {
  const journal = readJournal()
  if (!journal) return
  if (journal.recoveryTarget.kind === 'file') {
    await reconcileFileInstallation(journal)
  } else {
    await reconcileBibleInstallation(journal)
  }
  storage.remove(JOURNAL_KEY)
}
