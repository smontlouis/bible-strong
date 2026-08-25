import type { RootState } from '~redux/modules/reducer'
import type { MigrationState } from '~helpers/migrationState'
import type { MigrationProgressUpdate, MigrationResult } from '~helpers/firestoreMigration'
import type { SubcollectionName } from '~helpers/firestoreSubcollections'

import {
  createAccountMigrationContext,
  createFirestoreEmbeddedDataMigration,
  createFirestoreLegacyReferencesMigration,
  createRelationsArchitectureMigration,
  type FirestoreLegacyReferenceTarget,
  type AccountMigrationContext,
  runAccountMigrationSequence,
} from '../accountMigrationRegistry'
import {
  createAppMigrationOrchestrator,
  type AppMigrationDefinition,
  type MigrationContext,
  type MigrationSnapshot,
  type MigrationStateStore,
  type PersistedMigrationState,
} from '../appMigrationOrchestrator'

const state = { user: { id: 'user-1' } } as RootState
type EmbeddedMigrationDependencies = Parameters<typeof createFirestoreEmbeddedDataMigration>[0]
type EmbeddedMigrate = EmbeddedMigrationDependencies['migrate']

const createMemoryStore = (): MigrationStateStore => {
  let persisted: PersistedMigrationState | null = null
  let running = false

  return {
    load: async () => persisted,
    save: async next => {
      persisted = JSON.parse(JSON.stringify(next)) as PersistedMigrationState
    },
    runExclusive: async operation => {
      if (running) throw new Error('busy')
      running = true
      try {
        return await operation()
      } finally {
        running = false
      }
    },
  }
}

describe('account migration registry', () => {
  it('defers Firestore detection to the authenticated account and resumes legacy checkpoints', async () => {
    let hasEmbeddedData = true
    const inspectEmbeddedData = jest.fn<
      ReturnType<EmbeddedMigrationDependencies['inspectEmbeddedData']>,
      Parameters<EmbeddedMigrationDependencies['inspectEmbeddedData']>
    >(async _userId => ({
      hasEmbeddedData,
      collectionsWithData: hasEmbeddedData ? (['notes', 'bookmarks'] as SubcollectionName[]) : [],
    }))
    const legacyState = { userId: 'user-1', collections: {} } as MigrationState
    const getLegacyState = jest.fn(() => legacyState)
    const migrate = jest.fn<ReturnType<EmbeddedMigrate>, Parameters<EmbeddedMigrate>>(
      async (
        _userId: string,
        _state: RootState,
        existingState: MigrationState | null,
        onProgress: (progress: MigrationProgressUpdate) => void
      ): Promise<MigrationResult> => {
        onProgress({
          currentCollection: 'notes',
          collectionsCompleted: 1,
          totalCollections: 2,
          overallProgress: 0.6,
          message: 'private progress',
        })
        hasEmbeddedData = false
        return { success: true, partialFailure: false, failedCollections: [] }
      }
    )
    const migration = createFirestoreEmbeddedDataMigration({
      inspectEmbeddedData,
      getLegacyState,
      migrate,
    })
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [migration],
      store: createMemoryStore(),
    })
    const context = createAccountMigrationContext('user-1', state)
    const snapshots: MigrationSnapshot[] = []

    await runAccountMigrationSequence(orchestrator, context, snapshot => {
      snapshots.push(snapshot)
    })

    expect(inspectEmbeddedData).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', scopeId: 'user-1' })
    )
    expect(migrate).toHaveBeenCalledWith(
      'user-1',
      state,
      expect.objectContaining({ userId: 'user-1' }),
      expect.any(Function),
      undefined
    )
    expect(snapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'running',
          migrationId: 'firestore-embedded-user-data',
          progress: 0.6,
          message: 'migration.account.embedded.progress',
        }),
      ])
    )
    await expect(orchestrator.inspect(context)).resolves.toEqual({
      status: 'idle',
      isResuming: false,
    })
  })

  it('refreshes account inspection data after a recurring migration completes', async () => {
    const migration = createFirestoreEmbeddedDataMigration({
      inspectEmbeddedData: async context => ({
        hasEmbeddedData: Boolean(context.userDocument?.bible),
        collectionsWithData: context.userDocument?.bible ? ['notes'] : [],
      }),
      getLegacyState: () => null,
      migrate: async () => ({ success: true, partialFailure: false, failedCollections: [] }),
    })
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [migration],
      store: createMemoryStore(),
    })
    const context: AccountMigrationContext = {
      ...createAccountMigrationContext('user-1', state),
      userDocument: { bible: { notes: { note: {} } } },
    }
    const refreshContext = jest.fn(async (current: AccountMigrationContext) => ({
      ...current,
      userDocument: {},
    }))

    await expect(
      runAccountMigrationSequence(orchestrator, context, undefined, { refreshContext })
    ).resolves.toEqual({ status: 'idle', isResuming: false })
    expect(refreshContext).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed cloud migration resumable without leaking its raw error into state', async () => {
    let hasEmbeddedData = true
    const migrate = jest.fn<ReturnType<EmbeddedMigrate>, Parameters<EmbeddedMigrate>>(
      async (_userId, _state, _existingState, _onProgress): Promise<MigrationResult> => ({
        success: false,
        partialFailure: true,
        failedCollections: ['notes'],
        error: 'private document details',
      })
    )
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createFirestoreEmbeddedDataMigration({
          inspectEmbeddedData: async () => ({
            hasEmbeddedData,
            collectionsWithData: hasEmbeddedData ? ['notes'] : [],
          }),
          getLegacyState: () => null,
          migrate,
        }),
      ],
      store: createMemoryStore(),
    })
    const context = createAccountMigrationContext('user-1', state)

    const failed = await runAccountMigrationSequence(orchestrator, context)
    expect(failed).toMatchObject({
      status: 'failed',
      migrationId: 'firestore-embedded-user-data',
      errorCode: 'FIRESTORE_EMBEDDED_DATA_MIGRATION_FAILED',
    })

    migrate.mockImplementationOnce(async () => {
      hasEmbeddedData = false
      return { success: true, partialFailure: false, failedCollections: [] }
    })
    await expect(
      runAccountMigrationSequence(orchestrator, context, undefined, { retryFailed: true })
    ).resolves.toEqual({
      status: 'idle',
      isResuming: false,
    })
  })

  it('runs embedded data before the relations architecture in stable registry order', async () => {
    const operations: string[] = []
    const embedded = createFirestoreEmbeddedDataMigration({
      inspectEmbeddedData: async () => ({
        hasEmbeddedData: true,
        collectionsWithData: ['notes'],
      }),
      getLegacyState: () => null,
      migrate: async () => {
        operations.push('embedded')
        return { success: true, partialFailure: false, failedCollections: [] }
      },
    })
    let embeddedPresent = true
    embedded.detect = async context => {
      if (!embeddedPresent) return null
      embeddedPresent = false
      return {
        steps: [{ id: 'migrate', label: 'migration.account.embedded.step' }],
      }
    }
    const relations = createRelationsArchitectureMigration({
      inspectNeed: async () => ({ required: true }),
      migrate: async () => {
        operations.push('relations')
        return { success: true }
      },
    })
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [relations, embedded],
      store: createMemoryStore(),
    })

    await runAccountMigrationSequence(orchestrator, createAccountMigrationContext('user-1', state))

    expect(operations).toEqual(['embedded', 'relations'])
  })

  it('plans only technical Firestore targets and canonicalizes them before embedded migration', async () => {
    const migratedTargets: string[] = []
    let targets: FirestoreLegacyReferenceTarget[] = ['user-settings', 'subcollection:notes']
    const references = createFirestoreLegacyReferencesMigration({
      inspectTargets: async () => targets,
      migrateTarget: async (_userId, target, reportProgress) => {
        migratedTargets.push(target)
        reportProgress(1)
        targets = targets.filter(candidate => candidate !== target)
      },
    })
    const embedded = createFirestoreEmbeddedDataMigration({
      inspectEmbeddedData: async () => ({ hasEmbeddedData: false, collectionsWithData: [] }),
      getLegacyState: () => null,
      migrate: async () => ({ success: true, partialFailure: false, failedCollections: [] }),
    })
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [embedded, references],
      store: createMemoryStore(),
    })

    await runAccountMigrationSequence(orchestrator, createAccountMigrationContext('user-1', state))

    expect(migratedTargets).toEqual(['user-settings', 'subcollection:notes'])
    expect(references.order).toBeLessThan(embedded.order)
  })

  it('does not run account migrations when inspection finds no cloud work', async () => {
    const executeStep = jest.fn()
    const migration: AppMigrationDefinition<MigrationContext> = {
      id: 'none',
      version: 1,
      phase: 'account',
      order: 1,
      detect: async () => null,
      executeStep,
    }
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [migration],
      store: createMemoryStore(),
    })

    await expect(
      runAccountMigrationSequence(orchestrator, {
        phase: 'account',
        scopeId: 'user-1',
      })
    ).resolves.toEqual({ status: 'idle', isResuming: false })
    expect(executeStep).not.toHaveBeenCalled()
  })
})
