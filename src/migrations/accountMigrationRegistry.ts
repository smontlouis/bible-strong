import type { RootState } from '~redux/modules/reducer'
import type { MigrationState } from '~helpers/migrationState'
import type {
  MigrationProgressUpdate as FirestoreProgressUpdate,
  MigrationResult,
} from '~helpers/firestoreMigration'
import { SUBCOLLECTION_NAMES, type SubcollectionName } from '~helpers/firestoreSubcollectionNames'

import {
  MigrationExecutionError,
  type AppMigrationDefinition,
  type AppMigrationOrchestrator,
  type MigrationContext,
  type MigrationSnapshot,
  type MigrationSnapshotListener,
} from './appMigrationOrchestrator'

export interface AccountMigrationContext extends MigrationContext {
  phase: 'account'
  scopeId: string
  userId: string
  state: RootState
}

interface EmbeddedDataInspection {
  hasEmbeddedData: boolean
  collectionsWithData: SubcollectionName[]
}

interface FirestoreEmbeddedDataDependencies {
  inspectEmbeddedData(userId: string): Promise<EmbeddedDataInspection>
  getLegacyState(): MigrationState | null
  migrate(
    userId: string,
    state: RootState,
    existingState: MigrationState | null,
    onProgress: (progress: FirestoreProgressUpdate) => void
  ): Promise<MigrationResult>
}

interface RelationsArchitectureDependencies {
  inspectNeed(userId: string): Promise<{ required: boolean }>
  migrate(
    userId: string,
    state: RootState,
    onProgress?: (message: string, progress: number) => void
  ): Promise<{ success: boolean; error?: string }>
}

export const FIRESTORE_LEGACY_REFERENCE_SUBCOLLECTIONS: readonly SubcollectionName[] =
  SUBCOLLECTION_NAMES

export type FirestoreLegacyReferenceTarget =
  | 'user-settings'
  | `subcollection:${(typeof FIRESTORE_LEGACY_REFERENCE_SUBCOLLECTIONS)[number]}`

interface FirestoreLegacyReferencesDependencies {
  inspectTargets(userId: string): Promise<FirestoreLegacyReferenceTarget[]>
  migrateTarget(
    userId: string,
    target: FirestoreLegacyReferenceTarget,
    reportProgress: (progress: number) => void
  ): Promise<void>
}

const FIRESTORE_LEGACY_REFERENCE_TARGETS = new Set<FirestoreLegacyReferenceTarget>([
  'user-settings',
  ...FIRESTORE_LEGACY_REFERENCE_SUBCOLLECTIONS.map(
    collection => `subcollection:${collection}` as FirestoreLegacyReferenceTarget
  ),
])

export const createAccountMigrationContext = (
  userId: string,
  state: RootState
): AccountMigrationContext => ({
  phase: 'account',
  scopeId: userId,
  userId,
  state,
})

export const createFirestoreEmbeddedDataMigration = ({
  inspectEmbeddedData,
  getLegacyState,
  migrate,
}: FirestoreEmbeddedDataDependencies): AppMigrationDefinition<AccountMigrationContext> => ({
  id: 'firestore-embedded-user-data',
  version: 1,
  phase: 'account',
  order: 100,
  completionPolicy: 'recheck',
  async detect(context) {
    const inspection = await inspectEmbeddedData(context.userId)
    if (!inspection.hasEmbeddedData) return null

    return {
      steps: [
        {
          id: 'migrate-embedded-data',
          label: 'migration.account.embedded.step',
          resourceId: 'firestore:user-data-subcollections',
        },
      ],
      metadata: {
        collectionIds: [...inspection.collectionsWithData],
      },
    }
  },
  async executeStep({ context, reportProgress }) {
    const legacyState = getLegacyState()
    const existingState = legacyState?.userId === context.userId ? legacyState : null
    const result = await migrate(context.userId, context.state, existingState, progress => {
      reportProgress({
        progress: progress.overallProgress,
        message: 'migration.account.embedded.progress',
      })
    })

    if (!result.success) {
      throw new MigrationExecutionError('FIRESTORE_EMBEDDED_DATA_MIGRATION_FAILED')
    }
  },
})

export const createFirestoreLegacyReferencesMigration = ({
  inspectTargets,
  migrateTarget,
}: FirestoreLegacyReferencesDependencies): AppMigrationDefinition<AccountMigrationContext> => ({
  id: 'firestore-legacy-bible-references',
  version: 1,
  phase: 'account',
  order: 50,
  completionPolicy: 'recheck',
  async detect(context) {
    const targets = await inspectTargets(context.userId)
    if (targets.length === 0) return null
    if (targets.some(target => !FIRESTORE_LEGACY_REFERENCE_TARGETS.has(target))) {
      throw new MigrationExecutionError('FIRESTORE_LEGACY_REFERENCE_TARGET_INVALID')
    }

    return {
      steps: targets.map(target => ({
        id: `canonicalize:${target}`,
        label: 'migration.account.references.step',
        resourceId: `firestore:${target}`,
        payload: { target },
      })),
    }
  },
  async executeStep({ context, step, reportProgress }) {
    const target = step.payload?.target
    if (
      typeof target !== 'string' ||
      !FIRESTORE_LEGACY_REFERENCE_TARGETS.has(target as FirestoreLegacyReferenceTarget)
    ) {
      throw new MigrationExecutionError('FIRESTORE_LEGACY_REFERENCE_TARGET_INVALID')
    }

    await migrateTarget(context.userId, target as FirestoreLegacyReferenceTarget, progress => {
      reportProgress({
        progress,
        message: 'migration.account.references.progress',
      })
    })
  },
})

export const createRelationsArchitectureMigration = ({
  inspectNeed,
  migrate,
}: RelationsArchitectureDependencies): AppMigrationDefinition<AccountMigrationContext> => ({
  id: 'firestore-relations-architecture',
  version: 1,
  phase: 'account',
  order: 200,
  async detect(context) {
    const inspection = await inspectNeed(context.userId)
    if (!inspection.required) return null

    return {
      steps: [
        {
          id: 'migrate-relations-architecture',
          label: 'migration.account.relations.step',
          resourceId: 'firestore:relations-architecture',
        },
      ],
    }
  },
  async executeStep({ context, reportProgress }) {
    const result = await migrate(context.userId, context.state, (_message, progress) => {
      reportProgress({
        progress,
        message: 'migration.account.relations.progress',
      })
    })
    if (!result.success) {
      throw new MigrationExecutionError('FIRESTORE_RELATIONS_MIGRATION_FAILED')
    }
  },
})

const isTerminal = (snapshot: MigrationSnapshot): boolean =>
  snapshot.status === 'completed' || snapshot.status === 'abandoned-after-failure'

export const runAccountMigrationSequence = async <TContext extends MigrationContext>(
  orchestrator: AppMigrationOrchestrator<TContext>,
  context: TContext,
  onChange?: MigrationSnapshotListener,
  { retryFailed = false }: { retryFailed?: boolean } = {}
): Promise<MigrationSnapshot> => {
  let snapshot = await orchestrator.inspect(context)
  let canRetryPersistedFailure = retryFailed

  while (snapshot.status !== 'idle') {
    if (snapshot.status === 'failed' && !canRetryPersistedFailure) return snapshot
    canRetryPersistedFailure = false
    snapshot =
      snapshot.status === 'abandoning-after-failure'
        ? await orchestrator.abandon(context, onChange)
        : await orchestrator.run(context, onChange)
    if (snapshot.status === 'failed') return snapshot
    if (isTerminal(snapshot)) snapshot = await orchestrator.inspect(context)
  }

  return snapshot
}
