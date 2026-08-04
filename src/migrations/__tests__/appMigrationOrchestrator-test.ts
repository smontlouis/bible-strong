import {
  createAppMigrationOrchestrator,
  type AppMigrationDefinition,
  MigrationExecutionError,
  type MigrationEvent,
  type MigrationContext,
  type PersistedMigrationState,
  type MigrationStateStore,
} from '../appMigrationOrchestrator'

const context: MigrationContext = {
  phase: 'local',
  scopeId: 'device',
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

interface MemoryMigrationStateStore extends MigrationStateStore {
  value: unknown
  failNextSaveWhen(predicate: (state: PersistedMigrationState) => boolean): void
}

const createMemoryStore = (): MemoryMigrationStateStore => {
  let value: unknown = null
  let locked = false
  let saveFailurePredicate: ((state: PersistedMigrationState) => boolean) | undefined
  return {
    get value() {
      return clone(value)
    },
    set value(nextValue) {
      value = clone(nextValue)
    },
    async load() {
      return clone(value)
    },
    async save(nextValue) {
      if (saveFailurePredicate?.(nextValue)) {
        saveFailurePredicate = undefined
        throw new MigrationExecutionError('STATE_SAVE_FAILED')
      }
      value = clone(nextValue)
    },
    failNextSaveWhen(predicate) {
      saveFailurePredicate = predicate
    },
    async runExclusive(operation) {
      if (locked) throw new MigrationExecutionError('APP_MIGRATION_RUNNER_BUSY')
      locked = true
      try {
        return await operation()
      } finally {
        locked = false
      }
    },
  }
}

const createMigration = (
  overrides: Partial<AppMigrationDefinition> & Pick<AppMigrationDefinition, 'id' | 'order'>
): AppMigrationDefinition => {
  const { id, order, ...rest } = overrides
  return {
    id,
    version: 1,
    phase: 'local',
    order,
    async detect() {
      return {
        steps: [{ id: `${id}-step`, label: `${id}.step` }],
      }
    },
    async executeStep() {},
    ...rest,
  }
}

describe('appMigrationOrchestrator', () => {
  it('selects the first applicable migration in deterministic order and persists its plan', async () => {
    const store = createMemoryStore()
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({ id: 'later', order: 20 }),
        createMigration({ id: 'first', order: 10 }),
      ],
      store,
      now: () => 1_000,
    })

    await expect(orchestrator.inspect(context)).resolves.toMatchObject({
      status: 'awaiting-confirmation',
      migrationId: 'first',
      migrationVersion: 1,
      completedStepIds: [],
      isResuming: false,
      plan: {
        steps: [{ id: 'first-step', label: 'first.step' }],
      },
    })
    expect(store.value).toMatchObject({
      schemaVersion: 1,
      executions: [
        {
          scopeId: 'device',
          migrationId: 'first',
          migrationVersion: 1,
          status: 'awaiting-confirmation',
          createdAt: 1_000,
          updatedAt: 1_000,
        },
      ],
    })
  })

  it('uses locale-independent code-unit ordering to break migration order ties', async () => {
    const store = createMemoryStore()
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({ id: 'ä-migration', order: 10 }),
        createMigration({ id: 'z-migration', order: 10 }),
      ],
      store,
    })

    await expect(orchestrator.inspect(context)).resolves.toMatchObject({
      migrationId: 'z-migration',
    })
  })

  it('resumes an active execution before detecting newly applicable earlier migrations', async () => {
    const store = createMemoryStore()
    store.value = {
      schemaVersion: 1,
      executions: [
        {
          scopeId: 'device',
          migrationId: 'partially-applied',
          migrationVersion: 1,
          phase: 'local',
          status: 'failed',
          plan: { steps: [{ id: 'resume', label: 'partiallyApplied.resume' }] },
          completedStepIds: [],
          completedCleanupStepIds: [],
          currentStepId: 'resume',
          errorCode: 'OFFLINE',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    }
    const detectEarlier = jest.fn(async () => ({
      steps: [{ id: 'earlier-step', label: 'earlier.step' }],
    }))
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({ id: 'earlier', order: 10, detect: detectEarlier }),
        createMigration({ id: 'partially-applied', order: 20 }),
      ],
      store,
    })

    await expect(orchestrator.inspect(context)).resolves.toMatchObject({
      status: 'failed',
      migrationId: 'partially-applied',
      isResuming: true,
    })
    expect(detectEarlier).not.toHaveBeenCalled()
  })

  it('rejects duplicate migration registrations', () => {
    const store = createMemoryStore()

    expect(() =>
      createAppMigrationOrchestrator({
        migrations: [
          createMigration({ id: 'duplicate', order: 10 }),
          createMigration({ id: 'duplicate', order: 20 }),
        ],
        store,
      })
    ).toThrow('APP_MIGRATION_REGISTRY_INVALID')
  })

  it('keeps an older registered version available until its pending execution terminates', async () => {
    const store = createMemoryStore()
    const calls: string[] = []
    const versionOne = createMigration({
      id: 'upgrade-safe',
      version: 1,
      order: 10,
      async executeStep() {
        calls.push('v1')
      },
    })
    const versionTwo = createMigration({
      id: 'upgrade-safe',
      version: 2,
      order: 10,
      async executeStep() {
        calls.push('v2')
      },
    })
    const oldRunner = createAppMigrationOrchestrator({ migrations: [versionOne], store })
    await oldRunner.inspect(context)

    const upgradedRunner = createAppMigrationOrchestrator({
      migrations: [versionTwo, versionOne],
      store,
    })
    await expect(upgradedRunner.inspect(context)).resolves.toMatchObject({
      status: 'awaiting-confirmation',
      migrationVersion: 1,
    })
    await upgradedRunner.run(context)
    await expect(upgradedRunner.inspect(context)).resolves.toMatchObject({
      status: 'awaiting-confirmation',
      migrationVersion: 2,
    })
    await upgradedRunner.run(context)
    expect(calls).toEqual(['v1', 'v2'])
  })

  it('rejects conflicting orders across versions of one migration', () => {
    const store = createMemoryStore()

    expect(() =>
      createAppMigrationOrchestrator({
        migrations: [
          createMigration({ id: 'conflicting-order', version: 1, order: 20 }),
          createMigration({ id: 'conflicting-order', version: 2, order: 10 }),
          createMigration({ id: 'unrelated', order: 15 }),
        ],
        store,
      })
    ).toThrow('APP_MIGRATION_REGISTRY_INVALID')
  })

  it('runs applicable migrations sequentially and checkpoints every completed step', async () => {
    const store = createMemoryStore()
    const calls: string[] = []
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({
          id: 'second',
          order: 20,
          async executeStep({ step }) {
            calls.push(`execute:${step.id}`)
          },
          async finalizeIdempotently({ outcome }) {
            calls.push(`finalize:second:${outcome}`)
          },
        }),
        createMigration({
          id: 'first',
          order: 10,
          async detect() {
            return {
              steps: [
                { id: 'first-a', label: 'first.a' },
                { id: 'first-b', label: 'first.b' },
              ],
            }
          },
          async executeStep({ step }) {
            calls.push(`execute:${step.id}`)
          },
          async finalizeIdempotently({ outcome }) {
            calls.push(`finalize:first:${outcome}`)
          },
        }),
      ],
      store,
      now: () => 2_000,
    })

    await orchestrator.inspect(context)
    await expect(orchestrator.run(context)).resolves.toMatchObject({
      status: 'completed',
      migrationId: 'first',
      completedStepIds: ['first-a', 'first-b'],
    })
    expect(calls).toEqual(['execute:first-a', 'execute:first-b', 'finalize:first:completed'])
    await expect(orchestrator.inspect(context)).resolves.toMatchObject({
      status: 'awaiting-confirmation',
      migrationId: 'second',
    })
    await expect(orchestrator.run(context)).resolves.toMatchObject({
      status: 'completed',
      migrationId: 'second',
      completedStepIds: ['second-step'],
    })
    expect(calls).toEqual([
      'execute:first-a',
      'execute:first-b',
      'finalize:first:completed',
      'execute:second-step',
      'finalize:second:completed',
    ])
    expect(store.value).toMatchObject({
      executions: [
        { migrationId: 'first', status: 'completed', completedStepIds: ['first-a', 'first-b'] },
        { migrationId: 'second', status: 'completed', completedStepIds: ['second-step'] },
      ],
    })
  })

  it('resumes after failure without replaying completed steps', async () => {
    const store = createMemoryStore()
    const executedSteps: string[] = []
    let shouldFail = true
    const migration = createMigration({
      id: 'resumable',
      order: 10,
      async detect() {
        return {
          steps: [
            { id: 'download', label: 'resumable.download' },
            { id: 'activate', label: 'resumable.activate' },
          ],
        }
      },
      async executeStep({ step }) {
        executedSteps.push(step.id)
        if (step.id === 'activate' && shouldFail) {
          shouldFail = false
          throw new MigrationExecutionError('RESOURCE_ACTIVATION_FAILED')
        }
      },
    })
    const firstRunner = createAppMigrationOrchestrator({ migrations: [migration], store })

    await firstRunner.inspect(context)
    await expect(firstRunner.run(context)).resolves.toMatchObject({
      status: 'failed',
      migrationId: 'resumable',
      currentStepId: 'activate',
      completedStepIds: ['download'],
      errorCode: 'RESOURCE_ACTIVATION_FAILED',
      isResuming: true,
    })

    const resumedRunner = createAppMigrationOrchestrator({ migrations: [migration], store })
    await expect(resumedRunner.inspect(context)).resolves.toMatchObject({
      status: 'failed',
      completedStepIds: ['download'],
      isResuming: true,
    })
    await expect(resumedRunner.run(context)).resolves.toMatchObject({
      status: 'completed',
      completedStepIds: ['download', 'activate'],
    })
    expect(executedSteps).toEqual(['download', 'activate', 'activate'])
  })

  it('recovers when persisting a completed main-step checkpoint fails once', async () => {
    const store = createMemoryStore()
    const executed: string[] = []
    const migration = createMigration({
      id: 'main-checkpoint-save-failure',
      order: 10,
      async detect() {
        return {
          steps: [
            { id: 'first', label: 'saveFailure.first' },
            { id: 'second', label: 'saveFailure.second' },
          ],
        }
      },
      async executeStep({ step }) {
        executed.push(step.id)
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    store.failNextSaveWhen(state => {
      const execution = state.executions[0]
      return (
        execution.status === 'running' &&
        execution.completedStepIds.join(',') === 'first' &&
        typeof execution.currentStepId === 'undefined'
      )
    })
    await expect(orchestrator.run(context)).resolves.toMatchObject({
      status: 'failed',
      completedStepIds: ['first'],
      currentStepId: 'second',
      errorCode: 'STATE_SAVE_FAILED',
    })

    const resumedRunner = createAppMigrationOrchestrator({ migrations: [migration], store })
    await expect(resumedRunner.inspect(context)).resolves.toMatchObject({ status: 'failed' })
    await expect(resumedRunner.run(context)).resolves.toMatchObject({ status: 'completed' })
    expect(executed).toEqual(['first', 'second'])
  })

  it('recovers when persisting the completed terminal checkpoint fails once', async () => {
    const store = createMemoryStore()
    let finalizerCalls = 0
    const migration = createMigration({
      id: 'terminal-checkpoint-save-failure',
      order: 10,
      async finalizeIdempotently() {
        finalizerCalls += 1
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    store.failNextSaveWhen(state => state.executions[0]?.status === 'completed')
    await expect(orchestrator.run(context)).resolves.toMatchObject({
      status: 'failed',
      currentStepId: '__finalize__',
      errorCode: 'STATE_SAVE_FAILED',
    })

    const resumedRunner = createAppMigrationOrchestrator({ migrations: [migration], store })
    await expect(resumedRunner.inspect(context)).resolves.toMatchObject({ status: 'failed' })
    await expect(resumedRunner.run(context)).resolves.toMatchObject({ status: 'completed' })
    expect(finalizerCalls).toBe(2)
  })

  it('allows abandonment only after failure and finalizes it as a terminal outcome', async () => {
    const store = createMemoryStore()
    const outcomes: string[] = []
    const migration = createMigration({
      id: 'abandonable',
      order: 10,
      async executeStep() {
        throw new MigrationExecutionError('OFFLINE')
      },
      async finalizeIdempotently({ outcome }) {
        outcomes.push(outcome)
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    await expect(orchestrator.abandon(context)).rejects.toThrow('APP_MIGRATION_ABANDON_NOT_ALLOWED')
    await expect(orchestrator.run(context)).resolves.toMatchObject({ status: 'failed' })
    await expect(orchestrator.abandon(context)).resolves.toMatchObject({
      status: 'abandoned-after-failure',
      migrationId: 'abandonable',
    })
    expect(outcomes).toEqual(['abandoned-after-failure'])
    await expect(orchestrator.inspect(context)).resolves.toEqual({
      status: 'idle',
      isResuming: false,
    })
  })

  it('recovers when persisting an abandoned terminal checkpoint fails once', async () => {
    const store = createMemoryStore()
    let finalizerCalls = 0
    const migration = createMigration({
      id: 'abandon-checkpoint-save-failure',
      order: 10,
      async executeStep() {
        throw new MigrationExecutionError('OFFLINE')
      },
      async finalizeIdempotently() {
        finalizerCalls += 1
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    await orchestrator.run(context)
    store.failNextSaveWhen(state => state.executions[0]?.status === 'abandoned-after-failure')
    await expect(orchestrator.abandon(context)).resolves.toMatchObject({
      status: 'abandoning-after-failure',
      currentStepId: '__finalize__',
      errorCode: 'STATE_SAVE_FAILED',
    })

    const resumedRunner = createAppMigrationOrchestrator({ migrations: [migration], store })
    await expect(resumedRunner.inspect(context)).resolves.toMatchObject({
      status: 'abandoning-after-failure',
    })
    await expect(resumedRunner.abandon(context)).resolves.toMatchObject({
      status: 'abandoned-after-failure',
    })
    expect(finalizerCalls).toBe(2)
  })

  it('persists an abandonment decision and resumes its idempotent cleanup after failure', async () => {
    const store = createMemoryStore()
    const cleanupAttempts: string[] = []
    const events: MigrationEvent[] = []
    const migration = createMigration({
      id: 'abandon-cleanup-retry',
      order: 10,
      async detect() {
        return {
          steps: [{ id: 'install', label: 'abandon.install' }],
          cleanupSteps: [
            { id: 'remove-first', label: 'abandon.removeFirst', resourceId: 'legacy:first' },
            { id: 'remove-second', label: 'abandon.removeSecond', resourceId: 'legacy:second' },
          ],
        }
      },
      async executeStep() {
        throw new MigrationExecutionError('OFFLINE')
      },
      async finalizeIdempotently({ outcome, runCleanupStep }) {
        expect(outcome).toBe('abandoned-after-failure')
        await runCleanupStep('remove-first', async () => {
          cleanupAttempts.push('first')
        })
        await runCleanupStep('remove-second', async () => {
          cleanupAttempts.push('second')
          if (cleanupAttempts.filter(attempt => attempt === 'second').length === 1) {
            throw new MigrationExecutionError('CLEANUP_FAILED')
          }
        })
      },
    })
    const firstRunner = createAppMigrationOrchestrator({
      migrations: [migration],
      store,
      onEvent: event => events.push(event),
    })

    await firstRunner.inspect(context)
    await expect(firstRunner.run(context)).resolves.toMatchObject({ status: 'failed' })
    await expect(firstRunner.abandon(context)).resolves.toMatchObject({
      status: 'abandoning-after-failure',
      currentStepId: '__finalize__',
      currentCleanupStepId: 'remove-second',
      completedCleanupStepIds: ['remove-first'],
      errorCode: 'CLEANUP_FAILED',
    })

    const resumedRunner = createAppMigrationOrchestrator({
      migrations: [migration],
      store,
      onEvent: event => events.push(event),
    })
    await expect(resumedRunner.inspect(context)).resolves.toMatchObject({
      status: 'abandoning-after-failure',
      currentStepId: '__finalize__',
      currentCleanupStepId: 'remove-second',
      isResuming: true,
    })
    await expect(resumedRunner.run(context)).rejects.toThrow('APP_MIGRATION_ABANDON_IN_PROGRESS')
    await expect(resumedRunner.abandon(context)).resolves.toMatchObject({
      status: 'abandoned-after-failure',
      errorCode: undefined,
    })
    expect(cleanupAttempts).toEqual(['first', 'second', 'second'])
    expect(events).toContainEqual({
      name: 'failed',
      migrationId: 'abandon-cleanup-retry',
      migrationVersion: 1,
      phase: 'local',
      stepId: 'remove-second',
      resourceId: 'legacy:second',
      errorCode: 'CLEANUP_FAILED',
    })
  })

  it('restarts cleanup checkpoints when the terminal outcome changes to abandonment', async () => {
    const store = createMemoryStore()
    const operations: string[] = []
    const migration = createMigration({
      id: 'cleanup-outcome-switch',
      order: 10,
      async detect() {
        return {
          steps: [{ id: 'install', label: 'outcome.install' }],
          cleanupSteps: [
            { id: 'cleanup-first', label: 'outcome.cleanupFirst' },
            { id: 'cleanup-second', label: 'outcome.cleanupSecond' },
          ],
        }
      },
      async finalizeIdempotently({ outcome, runCleanupStep }) {
        await runCleanupStep('cleanup-first', async () => {
          operations.push(`${outcome}:first`)
        })
        await runCleanupStep('cleanup-second', async () => {
          operations.push(`${outcome}:second`)
          if (outcome === 'completed') {
            throw new MigrationExecutionError('COMPLETION_CLEANUP_FAILED')
          }
        })
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    await expect(orchestrator.run(context)).resolves.toMatchObject({
      status: 'failed',
      cleanupOutcome: 'completed',
      completedCleanupStepIds: ['cleanup-first'],
      currentCleanupStepId: 'cleanup-second',
    })
    await expect(orchestrator.abandon(context)).resolves.toMatchObject({
      status: 'abandoned-after-failure',
      cleanupOutcome: 'abandoned-after-failure',
      completedCleanupStepIds: ['cleanup-first', 'cleanup-second'],
    })
    expect(operations).toEqual([
      'completed:first',
      'completed:second',
      'abandoned-after-failure:first',
      'abandoned-after-failure:second',
    ])
  })

  it('protects cleanup accounting when a finalizer mutates its plan copy', async () => {
    const store = createMemoryStore()
    const cleanupOperations: string[] = []
    const migration = createMigration({
      id: 'mutating-finalizer',
      order: 10,
      async detect() {
        return {
          steps: [{ id: 'install', label: 'mutating.install' }],
          cleanupSteps: [{ id: 'remove', label: 'mutating.remove' }],
        }
      },
      async finalizeIdempotently({ plan, runCleanupStep }) {
        plan.cleanupSteps?.splice(0)
        await runCleanupStep('remove', async () => {
          cleanupOperations.push('remove')
        })
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    await expect(orchestrator.run(context)).resolves.toMatchObject({
      status: 'completed',
      completedCleanupStepIds: ['remove'],
      plan: { cleanupSteps: [{ id: 'remove', label: 'mutating.remove' }] },
    })
    expect(cleanupOperations).toEqual(['remove'])
  })

  it('rejects plans whose step identifiers cannot be checkpointed unambiguously', async () => {
    const store = createMemoryStore()
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({
          id: 'invalid-plan',
          order: 10,
          async detect() {
            return {
              steps: [
                { id: 'duplicate', label: 'first' },
                { id: 'duplicate', label: 'second' },
              ],
            }
          },
        }),
      ],
      store,
    })

    await expect(orchestrator.inspect(context)).rejects.toThrow('APP_MIGRATION_PLAN_INVALID')
    expect(store.value).toBeNull()
  })

  it('rejects declared cleanup resources without a terminal cleanup handler', async () => {
    const store = createMemoryStore()
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({
          id: 'missing-cleanup-handler',
          order: 10,
          async detect() {
            return {
              steps: [{ id: 'install', label: 'missing.install' }],
              cleanupSteps: [{ id: 'remove', label: 'missing.remove' }],
            }
          },
        }),
      ],
      store,
    })

    await expect(orchestrator.inspect(context)).rejects.toThrow(
      'APP_MIGRATION_CLEANUP_HANDLER_MISSING'
    )
    expect(store.value).toBeNull()
  })

  it('allows only one migration runner to mutate state at a time', async () => {
    const store = createMemoryStore()
    let releaseStep = () => {}
    let notifyStepStarted = () => {}
    const stepStarted = new Promise<void>(resolve => {
      notifyStepStarted = resolve
    })
    const waitForRelease = new Promise<void>(resolve => {
      releaseStep = resolve
    })
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({
          id: 'exclusive',
          order: 10,
          async executeStep() {
            notifyStepStarted()
            await waitForRelease
          },
        }),
      ],
      store,
    })

    await orchestrator.inspect(context)
    const firstRun = orchestrator.run(context)
    await stepStarted
    const competingRunner = createAppMigrationOrchestrator({
      migrations: [createMigration({ id: 'exclusive', order: 10 })],
      store,
    })
    await expect(competingRunner.run(context)).rejects.toThrow('APP_MIGRATION_RUNNER_BUSY')
    releaseStep()
    await expect(firstRun).resolves.toMatchObject({ status: 'completed' })
  })

  it('isolates local and account migrations by phase and scope', async () => {
    const store = createMemoryStore()
    const calls: string[] = []
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({
          id: 'local-only',
          order: 10,
          async executeStep() {
            calls.push('local')
          },
        }),
        createMigration({
          id: 'account-only',
          order: 10,
          phase: 'account',
          async executeStep() {
            calls.push('account')
          },
        }),
      ],
      store,
    })

    await orchestrator.inspect(context)
    await orchestrator.run(context)
    expect(calls).toEqual(['local'])
    const accountContext = { phase: 'account' as const, scopeId: 'user-42' }
    await orchestrator.inspect(accountContext)
    await orchestrator.run(accountContext)
    expect(calls).toEqual(['local', 'account'])
    expect(store.value).toMatchObject({
      executions: [
        { migrationId: 'local-only', scopeId: 'device' },
        { migrationId: 'account-only', scopeId: 'user-42' },
      ],
    })
  })

  it('runs a newer migration version even when the previous version completed', async () => {
    const store = createMemoryStore()
    const versionOne = createMigration({ id: 'versioned', order: 10 })
    const versionOneRunner = createAppMigrationOrchestrator({ migrations: [versionOne], store })
    await versionOneRunner.inspect(context)
    await versionOneRunner.run(context)

    const versionTwo = createMigration({ id: 'versioned', order: 10, version: 2 })
    const upgradedRunner = createAppMigrationOrchestrator({ migrations: [versionTwo], store })
    await expect(upgradedRunner.inspect(context)).resolves.toMatchObject({
      status: 'awaiting-confirmation',
      migrationId: 'versioned',
      migrationVersion: 2,
    })
  })

  it('rechecks recurring migrations after their previous execution completed', async () => {
    const store = createMemoryStore()
    let applicable = true
    const migration = createMigration({
      id: 'recurring',
      order: 10,
      completionPolicy: 'recheck',
      async detect() {
        return applicable ? { steps: [{ id: 'sync', label: 'recurring.sync' }] } : null
      },
      async finalizeIdempotently() {
        applicable = false
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    await orchestrator.run(context)
    await expect(orchestrator.inspect(context)).resolves.toEqual({
      status: 'idle',
      isResuming: false,
    })
    applicable = true
    await expect(orchestrator.inspect(context)).resolves.toMatchObject({
      status: 'awaiting-confirmation',
      migrationId: 'recurring',
      completedStepIds: [],
    })
  })

  it('fails closed when persisted orchestrator state uses an unsupported schema', async () => {
    const store = createMemoryStore()
    store.value = { schemaVersion: 2, executions: [] }
    const orchestrator = createAppMigrationOrchestrator({ migrations: [], store })

    await expect(orchestrator.inspect(context)).rejects.toThrow('APP_MIGRATION_STATE_UNSUPPORTED')
  })

  it('fails closed when schema-versioned execution state is malformed', async () => {
    const store = createMemoryStore()
    store.value = {
      schemaVersion: 1,
      executions: [{ migrationId: 'partial', status: 'running' }],
    }
    const orchestrator = createAppMigrationOrchestrator({ migrations: [], store })

    await expect(orchestrator.inspect(context)).rejects.toThrow('APP_MIGRATION_STATE_INVALID')
  })

  it('fails closed when a nonterminal execution has no exact registered definition', async () => {
    const store = createMemoryStore()
    store.value = {
      schemaVersion: 1,
      executions: [
        {
          scopeId: 'device',
          migrationId: 'removed-too-early',
          migrationVersion: 1,
          phase: 'local',
          status: 'awaiting-confirmation',
          plan: { steps: [{ id: 'step', label: 'removed.step' }] },
          completedStepIds: [],
          completedCleanupStepIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }
    const orchestrator = createAppMigrationOrchestrator({ migrations: [], store })

    await expect(orchestrator.inspect(context)).rejects.toThrow('APP_MIGRATION_DEFINITION_MISSING')
  })

  it.each([
    {
      name: 'completed execution with missing checkpoints',
      execution: {
        status: 'completed',
        completedStepIds: [],
      },
    },
    {
      name: 'execution whose checkpoints are not a plan prefix',
      execution: {
        status: 'running',
        completedStepIds: ['second'],
        currentStepId: 'first',
      },
    },
    {
      name: 'failed execution pointing at an unknown step',
      execution: {
        status: 'failed',
        completedStepIds: [],
        currentStepId: 'unknown',
        errorCode: 'FAILED',
      },
    },
    {
      name: 'plan with an empty technical resource identity',
      execution: {
        status: 'awaiting-confirmation',
        completedStepIds: [],
        plan: {
          steps: [{ id: 'first', label: 'strict.first', resourceId: ' ' }],
        },
      },
    },
    {
      name: 'running cleanup before installation steps are complete',
      execution: {
        status: 'running',
        completedStepIds: [],
        completedCleanupStepIds: [],
        currentStepId: undefined,
        currentCleanupStepId: 'remove',
        plan: {
          steps: [{ id: 'first', label: 'strict.first' }],
          cleanupSteps: [{ id: 'remove', label: 'strict.remove' }],
        },
      },
    },
  ])('fails closed for $name', async ({ execution }) => {
    const store = createMemoryStore()
    store.value = {
      schemaVersion: 1,
      executions: [
        {
          scopeId: 'device',
          migrationId: 'strict',
          migrationVersion: 1,
          phase: 'local',
          plan: {
            steps: [
              { id: 'first', label: 'strict.first' },
              { id: 'second', label: 'strict.second' },
            ],
          },
          completedCleanupStepIds: [],
          createdAt: 1,
          updatedAt: 1,
          ...execution,
        },
      ],
    }
    const orchestrator = createAppMigrationOrchestrator({ migrations: [], store })

    await expect(orchestrator.inspect(context)).rejects.toThrow('APP_MIGRATION_STATE_INVALID')
  })

  it('fails closed when persisted execution identities are duplicated', async () => {
    const store = createMemoryStore()
    const execution = {
      scopeId: 'device',
      migrationId: 'duplicate-state',
      migrationVersion: 1,
      phase: 'local' as const,
      status: 'awaiting-confirmation' as const,
      plan: { steps: [{ id: 'step', label: 'duplicate.step' }] },
      completedStepIds: [],
      completedCleanupStepIds: [],
      createdAt: 1,
      updatedAt: 1,
    }
    store.value = { schemaVersion: 1, executions: [execution, execution] }
    const orchestrator = createAppMigrationOrchestrator({ migrations: [], store })

    await expect(orchestrator.inspect(context)).rejects.toThrow('APP_MIGRATION_STATE_INVALID')
  })

  it('resumes a persisted detected state by presenting it before execution', async () => {
    const store = createMemoryStore()
    store.value = {
      schemaVersion: 1,
      executions: [
        {
          scopeId: 'device',
          migrationId: 'detected',
          migrationVersion: 1,
          phase: 'local',
          status: 'detected',
          plan: { steps: [{ id: 'step', label: 'detected.step' }] },
          completedStepIds: [],
          completedCleanupStepIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }
    const migration = createMigration({ id: 'detected', order: 10 })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await expect(orchestrator.run(context)).rejects.toThrow('APP_MIGRATION_CONFIRMATION_REQUIRED')
    await expect(orchestrator.inspect(context)).resolves.toMatchObject({
      status: 'awaiting-confirmation',
      migrationId: 'detected',
    })
  })

  it('resumes from a persisted running step checkpoint after process interruption', async () => {
    const store = createMemoryStore()
    store.value = {
      schemaVersion: 1,
      executions: [
        {
          scopeId: 'device',
          migrationId: 'interrupted',
          migrationVersion: 1,
          phase: 'local',
          status: 'running',
          plan: {
            steps: [
              { id: 'download', label: 'interrupted.download' },
              { id: 'activate', label: 'interrupted.activate' },
            ],
          },
          completedStepIds: ['download'],
          completedCleanupStepIds: [],
          currentStepId: 'activate',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    }
    const executed: string[] = []
    const migration = createMigration({
      id: 'interrupted',
      order: 10,
      async executeStep({ step }) {
        executed.push(step.id)
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await expect(orchestrator.run(context)).resolves.toMatchObject({ status: 'completed' })
    expect(executed).toEqual(['activate'])
  })

  it('replays only the idempotent finalizer after interruption during cleanup', async () => {
    const store = createMemoryStore()
    store.value = {
      schemaVersion: 1,
      executions: [
        {
          scopeId: 'device',
          migrationId: 'finalizing',
          migrationVersion: 1,
          phase: 'local',
          status: 'running',
          plan: {
            steps: [{ id: 'installed', label: 'finalizing.installed' }],
            cleanupSteps: [
              { id: 'cleanup-first', label: 'finalizing.cleanupFirst', resourceId: 'legacy:first' },
              {
                id: 'cleanup-second',
                label: 'finalizing.cleanupSecond',
                resourceId: 'legacy:second',
              },
            ],
          },
          completedStepIds: ['installed'],
          completedCleanupStepIds: ['cleanup-first'],
          cleanupOutcome: 'completed',
          currentStepId: '__finalize__',
          currentCleanupStepId: 'cleanup-second',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    }
    const executed: string[] = []
    const migration = createMigration({
      id: 'finalizing',
      order: 10,
      async executeStep({ step }) {
        executed.push(step.id)
      },
      async finalizeIdempotently({ runCleanupStep }) {
        await runCleanupStep('cleanup-first', async () => {
          executed.push('cleanup-first')
        })
        await runCleanupStep('cleanup-second', async () => {
          executed.push('cleanup-second')
        })
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await expect(orchestrator.run(context)).resolves.toMatchObject({ status: 'completed' })
    expect(executed).toEqual(['cleanup-second'])
  })

  it('keeps persisted timestamps valid when the wall clock moves backward', async () => {
    const store = createMemoryStore()
    let timestamp = 100
    const migration = createMigration({ id: 'clock-rollback', order: 10 })
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [migration],
      store,
      now: () => timestamp,
    })

    await orchestrator.inspect(context)
    timestamp = 50
    await expect(orchestrator.run(context)).resolves.toMatchObject({ status: 'completed' })
    expect(store.value).toMatchObject({
      executions: [{ createdAt: 100, updatedAt: 100 }],
    })
    await expect(orchestrator.inspect(context)).resolves.toEqual({
      status: 'idle',
      isResuming: false,
    })
  })

  it('emits structured lifecycle events without migration plan content', async () => {
    const store = createMemoryStore()
    const events: MigrationEvent[] = []
    const orchestrator = createAppMigrationOrchestrator({
      migrations: [
        createMigration({
          id: 'observable',
          order: 10,
          async detect() {
            return {
              steps: [
                {
                  id: 'observable-step',
                  label: 'observable.step',
                  resourceId: 'resource:one',
                },
              ],
            }
          },
          async finalizeIdempotently() {},
        }),
      ],
      store,
      onEvent: event => {
        events.push(event)
        throw new Error('observer failed')
      },
    })

    await orchestrator.inspect(context)
    await expect(
      orchestrator.run(context, () => {
        throw new Error('presentation observer failed')
      })
    ).resolves.toMatchObject({ status: 'completed' })

    expect(events).toEqual([
      {
        name: 'detected',
        migrationId: 'observable',
        migrationVersion: 1,
        phase: 'local',
      },
      {
        name: 'started',
        migrationId: 'observable',
        migrationVersion: 1,
        phase: 'local',
      },
      {
        name: 'step-completed',
        migrationId: 'observable',
        migrationVersion: 1,
        phase: 'local',
        stepId: 'observable-step',
        resourceId: 'resource:one',
      },
      {
        name: 'cleanup-started',
        migrationId: 'observable',
        migrationVersion: 1,
        phase: 'local',
      },
      {
        name: 'cleanup-completed',
        migrationId: 'observable',
        migrationVersion: 1,
        phase: 'local',
      },
      {
        name: 'completed',
        migrationId: 'observable',
        migrationVersion: 1,
        phase: 'local',
      },
    ])
  })

  it('does not expose mutable execution state to presentation observers', async () => {
    const store = createMemoryStore()
    const migration = createMigration({
      id: 'observer-isolation',
      order: 10,
      async detect() {
        return {
          steps: [
            { id: 'first', label: 'observer.first' },
            { id: 'second', label: 'observer.second' },
          ],
        }
      },
    })
    const orchestrator = createAppMigrationOrchestrator({ migrations: [migration], store })

    await orchestrator.inspect(context)
    await expect(
      orchestrator.run(context, snapshot => {
        if (snapshot.status === 'idle') return
        snapshot.completedStepIds.push('injected')
        snapshot.plan.steps.splice(0, snapshot.plan.steps.length)
      })
    ).resolves.toMatchObject({
      status: 'completed',
      completedStepIds: ['first', 'second'],
      plan: {
        steps: [
          { id: 'first', label: 'observer.first' },
          { id: 'second', label: 'observer.second' },
        ],
      },
    })
  })
})
