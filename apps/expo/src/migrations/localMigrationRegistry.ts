import { appLogger } from '~helpers/agentObservability'
import { reconcileResourceInstallationJournal } from '~helpers/resourceInstallationJournal'
import { prepareLegacyStorageForLocalMigrations } from '~helpers/storage'

import { createAppMigrationOrchestrator, type MigrationContext } from './appMigrationOrchestrator'
import { legacyResourceMigration } from './legacyResourceMigrationRuntime'
import { createMmkvMigrationStateStore } from './mmkvMigrationStateStore'

export const localMigrationContext: MigrationContext = {
  phase: 'local',
  scopeId: 'device',
}

let defaultPreparationPromise: Promise<void> | undefined

export const prepareLocalMigrationInspection = async ({
  prepareStorage = prepareLegacyStorageForLocalMigrations,
  reconcileInstallationJournal = reconcileResourceInstallationJournal,
}: {
  prepareStorage?: () => Promise<void>
  reconcileInstallationJournal?: () => Promise<void>
} = {}): Promise<void> => {
  const runPreparation = async (): Promise<void> => {
    await prepareStorage()
    await reconcileInstallationJournal()
  }
  const usesDefaultDependencies =
    prepareStorage === prepareLegacyStorageForLocalMigrations &&
    reconcileInstallationJournal === reconcileResourceInstallationJournal
  if (!usesDefaultDependencies) {
    await runPreparation()
    return
  }

  defaultPreparationPromise ??= runPreparation().catch(error => {
    defaultPreparationPromise = undefined
    throw error
  })
  await defaultPreparationPromise
}

export const localMigrationOrchestrator = createAppMigrationOrchestrator({
  migrations: [legacyResourceMigration],
  store: createMmkvMigrationStateStore(),
  onEvent: event => {
    const payload = {
      migrationId: event.migrationId,
      migrationVersion: event.migrationVersion,
      phase: event.phase,
      stepId: event.stepId,
      resourceId: event.resourceId,
      errorCode: event.errorCode,
    }
    if (event.name === 'failed') {
      appLogger.error('startup', `app_migration.${event.name}`, payload)
    } else {
      appLogger.info('startup', `app_migration.${event.name}`, payload)
    }
  },
  onFailure: event => {
    appLogger.captureError('startup', 'app_migration.failed', event.cause, {
      migrationId: event.migrationId,
      migrationVersion: event.migrationVersion,
      phase: event.phase,
      stepId: event.stepId,
      resourceId: event.resourceId,
      errorCode: event.errorCode,
    })
  },
})

export const prepareLocalMigrationStartup = async ({
  orchestrator = localMigrationOrchestrator,
  context = localMigrationContext,
  prepareInspection = prepareLocalMigrationInspection,
}: {
  orchestrator?: Pick<typeof localMigrationOrchestrator, 'getStartupDisposition'>
  context?: MigrationContext
  prepareInspection?: () => Promise<void>
} = {}): Promise<void> => {
  if (orchestrator.getStartupDisposition(context).kind !== 'ready') {
    await prepareInspection()
  }
}
