import { appLogger } from '~helpers/agentObservability'
import {
  inspectEmbeddedDataMigration,
  inspectRelationsArchitectureMigration,
  migrateUserRelationsArchitecture,
  resumableMigrateUserData,
} from '~helpers/firestoreMigration'
import { getMigrationState } from '~helpers/migrationState'

import { createAppMigrationOrchestrator } from './appMigrationOrchestrator'
import {
  createFirestoreEmbeddedDataMigration,
  createFirestoreLegacyReferencesMigration,
  createRelationsArchitectureMigration,
} from './accountMigrationRegistry'
import { legacyFirestoreReferencesAdapter } from './legacyFirestoreReferencesRuntime'
import { createMmkvMigrationStateStore } from './mmkvMigrationStateStore'

export const accountMigrationOrchestrator = createAppMigrationOrchestrator({
  migrations: [
    createFirestoreLegacyReferencesMigration(legacyFirestoreReferencesAdapter),
    createFirestoreEmbeddedDataMigration({
      inspectEmbeddedData: inspectEmbeddedDataMigration,
      getLegacyState: getMigrationState,
      migrate: resumableMigrateUserData,
    }),
    createRelationsArchitectureMigration({
      inspectNeed: inspectRelationsArchitectureMigration,
      migrate: migrateUserRelationsArchitecture,
    }),
  ],
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
