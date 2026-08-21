import { appLogger } from '~helpers/agentObservability'
import {
  inspectEmbeddedDataFromUserDocument,
  inspectRelationsArchitectureFromUserDocument,
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
import { firebaseDb, doc, getDoc } from '~helpers/firebase'
import type { AccountMigrationContext } from './accountMigrationRegistry'

export const prepareAccountMigrationContext = async (
  context: AccountMigrationContext
): Promise<AccountMigrationContext> => {
  const snapshot = await getDoc(doc(firebaseDb, 'users', context.userId))
  return {
    ...context,
    userDocument: (snapshot.data() as Record<string, unknown> | undefined) ?? {},
  }
}

export const accountMigrationOrchestrator = createAppMigrationOrchestrator({
  migrations: [
    createFirestoreLegacyReferencesMigration({
      // New legacy references are canonicalized from normal listener snapshots. Keep the
      // definition registered so an execution detected by an older build can still resume.
      inspectTargets: async () => [],
      migrateTarget: legacyFirestoreReferencesAdapter.migrateTarget,
    }),
    createFirestoreEmbeddedDataMigration({
      inspectEmbeddedData: async context =>
        inspectEmbeddedDataFromUserDocument(context.userDocument),
      getLegacyState: getMigrationState,
      migrate: resumableMigrateUserData,
    }),
    createRelationsArchitectureMigration({
      inspectNeed: async context =>
        inspectRelationsArchitectureFromUserDocument(context.userDocument),
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
  onFailure: event => {
    appLogger.captureError('startup', 'account_migration.failed', event.cause, {
      migrationId: event.migrationId,
      migrationVersion: event.migrationVersion,
      phase: event.phase,
      stepId: event.stepId,
      resourceId: event.resourceId,
      errorCode: event.errorCode,
    })
  },
})
