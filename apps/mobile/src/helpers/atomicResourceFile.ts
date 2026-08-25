import * as FileSystem from 'expo-file-system/legacy'
import { appLogger } from './agentObservability'

export const restoreOrphanedResourceBackup = async (
  destinationPath: string,
  backupPath: string
): Promise<void> => {
  const [destination, backup] = await Promise.all([
    FileSystem.getInfoAsync(destinationPath),
    FileSystem.getInfoAsync(backupPath),
  ])
  if (!destination.exists && backup.exists) {
    await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
  }
}

export type AtomicResourceFileInstallation = {
  candidatePath: string
  destinationPath: string
  beforeSwap?: () => void | Promise<void>
  afterSwap?: () => void | Promise<void>
  beforeRollback?: () => void | Promise<void>
  afterRollback?: (restoredPreviousCopy: boolean) => void | Promise<void>
}

export class AtomicResourceFileRollbackError extends Error {
  readonly originalError: unknown
  readonly rollbackErrors: unknown[]

  constructor(originalError: unknown, rollbackErrors: unknown[]) {
    super('ATOMIC_RESOURCE_FILE_ROLLBACK_INCOMPLETE')
    this.name = 'AtomicResourceFileRollbackError'
    this.originalError = originalError
    this.rollbackErrors = rollbackErrors
  }
}

export const isAtomicResourceFileRollbackError = (
  error: unknown
): error is AtomicResourceFileRollbackError => error instanceof AtomicResourceFileRollbackError

export type ActivatedResourceFile = {
  destinationPath: string
  backupPath: string
  previousCopyMoved: boolean
}

export const rollbackActivatedResourceFiles = async (
  activations: readonly ActivatedResourceFile[],
  originalError: unknown
): Promise<void> => {
  const rollbackErrors: unknown[] = []
  for (const activation of [...activations].reverse()) {
    try {
      await FileSystem.deleteAsync(activation.destinationPath, { idempotent: true })
    } catch (error) {
      rollbackErrors.push(error)
    }
    if (activation.previousCopyMoved) {
      try {
        await FileSystem.moveAsync({
          from: activation.backupPath,
          to: activation.destinationPath,
        })
      } catch (error) {
        rollbackErrors.push(error)
      }
    }
  }
  if (rollbackErrors.length > 0) {
    throw new AtomicResourceFileRollbackError(originalError, rollbackErrors)
  }
}

export const installAtomicResourceFile = async ({
  candidatePath,
  destinationPath,
  beforeSwap,
  afterSwap,
  beforeRollback,
  afterRollback,
}: AtomicResourceFileInstallation): Promise<void> => {
  const backupPath = `${destinationPath}.backup`
  let previousCopyMoved = false
  let candidateActivationStarted = false

  try {
    await beforeSwap?.()
    await restoreOrphanedResourceBackup(destinationPath, backupPath)
    await FileSystem.deleteAsync(backupPath, { idempotent: true })

    const installed = await FileSystem.getInfoAsync(destinationPath)
    if (installed.exists) {
      await FileSystem.moveAsync({ from: destinationPath, to: backupPath })
      previousCopyMoved = true
    }

    candidateActivationStarted = true
    await FileSystem.moveAsync({ from: candidatePath, to: destinationPath })
    await afterSwap?.()
  } catch (error) {
    const rollbackErrors: unknown[] = []
    try {
      await beforeRollback?.()
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }

    if (candidateActivationStarted || previousCopyMoved) {
      try {
        await FileSystem.deleteAsync(destinationPath, { idempotent: true })
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (previousCopyMoved) {
      try {
        await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }

    let restoredPreviousCopy = false
    try {
      const restored = await FileSystem.getInfoAsync(destinationPath)
      restoredPreviousCopy = restored.exists
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
    try {
      await afterRollback?.(restoredPreviousCopy)
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
    if (rollbackErrors.length > 0) {
      console.error('[AtomicResourceFile] Rollback completed with errors:', rollbackErrors)
      throw new AtomicResourceFileRollbackError(error, rollbackErrors)
    }
    throw error
  }

  // Activation and its durable commit are complete. A stale backup is safe and
  // will be cleaned before the next swap; its deletion must not reopen the
  // rollback window after the new copy has been committed.
  try {
    await FileSystem.deleteAsync(backupPath, { idempotent: true })
  } catch (error) {
    appLogger.captureError('download', 'atomic_resource.stale_backup_cleanup_failed', error)
    console.warn('[AtomicResourceFile] Could not remove stale backup:', error)
  }
}
