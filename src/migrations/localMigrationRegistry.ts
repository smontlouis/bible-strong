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

export const prepareLocalMigrationInspection = async ({
  prepareStorage = prepareLegacyStorageForLocalMigrations,
  reconcileInstallationJournal = reconcileResourceInstallationJournal,
}: {
  prepareStorage?: () => Promise<void>
  reconcileInstallationJournal?: () => Promise<void>
} = {}): Promise<void> => {
  await prepareStorage()
  await reconcileInstallationJournal()
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
})
