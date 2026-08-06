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
  userDocument?: Record<string, unknown>
}

interface EmbeddedDataInspection {
  hasEmbeddedData: boolean
  collectionsWithData: SubcollectionName[]
}

interface FirestoreEmbeddedDataDependencies {
  inspectEmbeddedData(context: AccountMigrationContext): Promise<EmbeddedDataInspection>
  getLegacyState(): MigrationState | null
  migrate(
    userId: string,
    state: RootState,
    existingState: MigrationState | null,
    onProgress: (progress: FirestoreProgressUpdate) => void,
    userDocument?: Record<string, unknown>
  ): Promise<MigrationResult>
}

interface RelationsArchitectureDependencies {
  inspectNeed(context: AccountMigrationContext): Promise<{ required: boolean }>
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
  inspectTargets(context: AccountMigrationContext): Promise<FirestoreLegacyReferenceTarget[]>
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
    const inspection = await inspectEmbeddedData(context)
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
    const result = await migrate(
      context.userId,
      context.state,
      existingState,
      progress => {
        reportProgress({
          progress: progress.overallProgress,
          message: 'migration.account.embedded.progress',
        })
      },
      context.userDocument
    )

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
  async detect(context) {
    const targets = await inspectTargets(context)
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
    const inspection = await inspectNeed(context)
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
  {
    retryFailed = false,
    requireConfirmation = false,
    refreshContext,
  }: {
    retryFailed?: boolean
    requireConfirmation?: boolean
    refreshContext?: (context: TContext) => Promise<TContext>
  } = {}
): Promise<MigrationSnapshot> => {
  let currentContext = context
  let snapshot = await orchestrator.inspect(currentContext)
  if (
    requireConfirmation &&
    (snapshot.status === 'detected' || snapshot.status === 'awaiting-confirmation')
  ) {
    return snapshot
  }
  let canRetryPersistedFailure = retryFailed

  while (snapshot.status !== 'idle') {
    if (snapshot.status === 'failed' && !canRetryPersistedFailure) return snapshot
    canRetryPersistedFailure = false
    snapshot =
      snapshot.status === 'abandoning-after-failure'
        ? await orchestrator.abandon(currentContext, onChange)
        : await orchestrator.run(currentContext, onChange)
    if (snapshot.status === 'failed') return snapshot
    if (snapshot.status === 'completed' && refreshContext) {
      currentContext = await refreshContext(currentContext)
    }
    if (isTerminal(snapshot)) snapshot = await orchestrator.inspect(currentContext)
  }

  return snapshot
}
