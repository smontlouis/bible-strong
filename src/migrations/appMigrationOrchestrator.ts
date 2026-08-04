export type MigrationPhase = 'local' | 'account'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface MigrationContext {
  phase: MigrationPhase
  scopeId: string
}

export interface MigrationStep {
  id: string
  label: string
  resourceId?: string
  payload?: { [key: string]: JsonValue }
}

export interface MigrationPlan {
  steps: MigrationStep[]
  cleanupSteps?: MigrationStep[]
  metadata?: { [key: string]: JsonValue }
}

export type MigrationTerminalOutcome = 'completed' | 'abandoned-after-failure'
export type MigrationExecutionStatus =
  | 'detected'
  | 'awaiting-confirmation'
  | 'running'
  | 'failed'
  | 'abandoning-after-failure'
  | MigrationTerminalOutcome

export interface MigrationProgressUpdate {
  progress: number
  message?: string
}

export type MigrationEventName =
  | 'detected'
  | 'started'
  | 'retry'
  | 'step-completed'
  | 'failed'
  | 'completed'
  | 'abandoned-after-failure'
  | 'cleanup-started'
  | 'cleanup-completed'

export interface MigrationEvent {
  name: MigrationEventName
  migrationId: string
  migrationVersion: number
  phase: MigrationPhase
  stepId?: string
  resourceId?: string
  errorCode?: string
}

export interface AppMigrationDefinition<TContext extends MigrationContext = MigrationContext> {
  id: string
  version: number
  phase: MigrationPhase
  order: number
  completionPolicy?: 'once' | 'recheck'
  detect(context: TContext): Promise<MigrationPlan | null>
  executeStep(input: {
    context: TContext
    plan: MigrationPlan
    step: MigrationStep
    reportProgress(update: MigrationProgressUpdate): void
  }): Promise<void>
  finalizeIdempotently?(input: {
    context: TContext
    plan: MigrationPlan
    outcome: MigrationTerminalOutcome
    runCleanupStep(
      stepId: string,
      operation: (reportProgress: (update: MigrationProgressUpdate) => void) => Promise<void>
    ): Promise<void>
  }): Promise<void>
}

export interface PersistedMigrationExecution {
  scopeId: string
  migrationId: string
  migrationVersion: number
  phase: MigrationPhase
  status: MigrationExecutionStatus
  plan: MigrationPlan
  completedStepIds: string[]
  completedCleanupStepIds: string[]
  cleanupOutcome?: MigrationTerminalOutcome
  currentStepId?: string
  currentCleanupStepId?: string
  errorCode?: string
  createdAt: number
  updatedAt: number
}

export interface PersistedMigrationState {
  schemaVersion: 1
  executions: PersistedMigrationExecution[]
}

export interface MigrationStateStore {
  load(): Promise<unknown | null>
  save(state: PersistedMigrationState): Promise<void>
  runExclusive<T>(operation: () => Promise<T>): Promise<T>
}

export class MigrationExecutionError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'MigrationExecutionError'
  }
}

export type MigrationSnapshot =
  | { status: 'idle'; isResuming: false }
  | {
      status: MigrationExecutionStatus
      migrationId: string
      migrationVersion: number
      plan: MigrationPlan
      completedStepIds: string[]
      completedCleanupStepIds: string[]
      cleanupOutcome?: MigrationTerminalOutcome
      currentStepId?: string
      currentCleanupStepId?: string
      progress?: number
      message?: string
      errorCode?: string
      isResuming: boolean
    }

export type MigrationSnapshotListener = (snapshot: MigrationSnapshot) => void

export interface AppMigrationOrchestrator<TContext extends MigrationContext = MigrationContext> {
  inspect(context: TContext): Promise<MigrationSnapshot>
  run(context: TContext, onChange?: MigrationSnapshotListener): Promise<MigrationSnapshot>
  abandon(context: TContext, onChange?: MigrationSnapshotListener): Promise<MigrationSnapshot>
}

interface AppMigrationOrchestratorOptions<TContext extends MigrationContext> {
  migrations: AppMigrationDefinition<TContext>[]
  store: MigrationStateStore
  now?: () => number
  onEvent?: (event: MigrationEvent) => void
}

const createEmptyState = (): PersistedMigrationState => ({
  schemaVersion: 1,
  executions: [],
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isJsonValue = (value: unknown): value is JsonValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true
  }
  if (Array.isArray(value)) return value.every(isJsonValue)
  return isRecord(value) && Object.values(value).every(isJsonValue)
}

const areMigrationSteps = (value: unknown, allowEmpty: boolean): value is MigrationStep[] =>
  Array.isArray(value) &&
  (allowEmpty || value.length > 0) &&
  value.every(
    step =>
      isRecord(step) &&
      typeof step.id === 'string' &&
      Boolean(step.id.trim()) &&
      typeof step.label === 'string' &&
      Boolean(step.label.trim()) &&
      (typeof step.resourceId === 'undefined' ||
        (typeof step.resourceId === 'string' && Boolean(step.resourceId.trim()))) &&
      (typeof step.payload === 'undefined' || (isRecord(step.payload) && isJsonValue(step.payload)))
  ) &&
  new Set(value.map(step => step.id)).size === value.length

const isMigrationPlan = (value: unknown): value is MigrationPlan => {
  if (
    !isRecord(value) ||
    !areMigrationSteps(value.steps, false) ||
    (typeof value.cleanupSteps !== 'undefined' && !areMigrationSteps(value.cleanupSteps, true)) ||
    (typeof value.metadata !== 'undefined' &&
      (!isRecord(value.metadata) || !isJsonValue(value.metadata)))
  ) {
    return false
  }
  return true
}

const MIGRATION_STATUSES = new Set<MigrationExecutionStatus>([
  'detected',
  'awaiting-confirmation',
  'running',
  'failed',
  'abandoning-after-failure',
  'completed',
  'abandoned-after-failure',
])

const isPersistedExecution = (value: unknown): value is PersistedMigrationExecution => {
  if (
    !isRecord(value) ||
    typeof value.scopeId !== 'string' ||
    !value.scopeId.trim() ||
    typeof value.migrationId !== 'string' ||
    !value.migrationId.trim() ||
    typeof value.migrationVersion !== 'number' ||
    !Number.isInteger(value.migrationVersion) ||
    value.migrationVersion < 1 ||
    (value.phase !== 'local' && value.phase !== 'account') ||
    typeof value.status !== 'string' ||
    !MIGRATION_STATUSES.has(value.status as MigrationExecutionStatus) ||
    !isMigrationPlan(value.plan) ||
    !Array.isArray(value.completedStepIds) ||
    !value.completedStepIds.every(stepId => typeof stepId === 'string') ||
    !Array.isArray(value.completedCleanupStepIds) ||
    !value.completedCleanupStepIds.every(stepId => typeof stepId === 'string') ||
    (typeof value.cleanupOutcome !== 'undefined' &&
      value.cleanupOutcome !== 'completed' &&
      value.cleanupOutcome !== 'abandoned-after-failure') ||
    (typeof value.currentStepId !== 'undefined' && typeof value.currentStepId !== 'string') ||
    (typeof value.currentCleanupStepId !== 'undefined' &&
      typeof value.currentCleanupStepId !== 'string') ||
    (typeof value.errorCode !== 'undefined' && typeof value.errorCode !== 'string') ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) {
    return false
  }

  const planStepIds = value.plan.steps.map(step => step.id)
  const cleanupStepIds = value.plan.cleanupSteps?.map(step => step.id) ?? []
  const completedStepIds = value.completedStepIds as string[]
  const completedCleanupStepIds = value.completedCleanupStepIds as string[]
  const completedStepsArePrefix = completedStepIds.every(
    (stepId, index) => planStepIds[index] === stepId
  )
  if (!completedStepsArePrefix || new Set(completedStepIds).size !== completedStepIds.length) {
    return false
  }
  const completedCleanupStepsArePrefix = completedCleanupStepIds.every(
    (stepId, index) => cleanupStepIds[index] === stepId
  )
  if (
    !completedCleanupStepsArePrefix ||
    new Set(completedCleanupStepIds).size !== completedCleanupStepIds.length
  ) {
    return false
  }

  const allStepsCompleted = completedStepIds.length === planStepIds.length
  const allCleanupStepsCompleted = completedCleanupStepIds.length === cleanupStepIds.length
  const cleanupHasStarted =
    typeof value.cleanupOutcome !== 'undefined' ||
    completedCleanupStepIds.length > 0 ||
    typeof value.currentCleanupStepId !== 'undefined'
  const cleanupStateIsEmpty =
    completedCleanupStepIds.length === 0 &&
    typeof value.currentCleanupStepId === 'undefined' &&
    typeof value.cleanupOutcome === 'undefined'
  const currentStepIsNext =
    typeof value.currentStepId === 'undefined' ||
    value.currentStepId === planStepIds[completedStepIds.length] ||
    (value.currentStepId === '__finalize__' && allStepsCompleted)
  const currentCleanupStepIsNext =
    typeof value.currentCleanupStepId === 'undefined' ||
    value.currentCleanupStepId === cleanupStepIds[completedCleanupStepIds.length]
  if (
    (cleanupStepIds.length === 0 && !cleanupStateIsEmpty) ||
    ((completedCleanupStepIds.length > 0 || typeof value.currentCleanupStepId !== 'undefined') &&
      typeof value.cleanupOutcome === 'undefined')
  ) {
    return false
  }

  switch (value.status) {
    case 'detected':
    case 'awaiting-confirmation':
      return (
        completedStepIds.length === 0 &&
        cleanupStateIsEmpty &&
        typeof value.currentStepId === 'undefined' &&
        typeof value.currentCleanupStepId === 'undefined' &&
        typeof value.errorCode === 'undefined'
      )
    case 'running':
      return (
        currentStepIsNext &&
        currentCleanupStepIsNext &&
        (!cleanupHasStarted ||
          (allStepsCompleted &&
            value.currentStepId === '__finalize__' &&
            value.cleanupOutcome === 'completed')) &&
        typeof value.errorCode === 'undefined'
      )
    case 'failed':
      return (
        typeof value.currentStepId !== 'undefined' &&
        currentStepIsNext &&
        currentCleanupStepIsNext &&
        (!cleanupHasStarted ||
          (allStepsCompleted &&
            value.currentStepId === '__finalize__' &&
            value.cleanupOutcome === 'completed')) &&
        typeof value.errorCode === 'string'
      )
    case 'abandoning-after-failure':
      return (
        value.currentStepId === '__finalize__' &&
        currentCleanupStepIsNext &&
        (cleanupStepIds.length === 0
          ? cleanupStateIsEmpty
          : value.cleanupOutcome === 'abandoned-after-failure')
      )
    case 'completed':
      return (
        allStepsCompleted &&
        allCleanupStepsCompleted &&
        (cleanupStepIds.length === 0
          ? cleanupStateIsEmpty
          : value.cleanupOutcome === 'completed') &&
        typeof value.currentStepId === 'undefined' &&
        typeof value.currentCleanupStepId === 'undefined' &&
        typeof value.errorCode === 'undefined'
      )
    case 'abandoned-after-failure':
      return (
        allCleanupStepsCompleted &&
        (cleanupStepIds.length === 0
          ? cleanupStateIsEmpty
          : value.cleanupOutcome === 'abandoned-after-failure') &&
        typeof value.currentStepId === 'undefined' &&
        typeof value.currentCleanupStepId === 'undefined' &&
        typeof value.errorCode === 'undefined'
      )
  }

  return false
}

const parseState = (value: unknown): PersistedMigrationState => {
  if (value === null || typeof value === 'undefined') return createEmptyState()
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1 ||
    !('executions' in value) ||
    !Array.isArray(value.executions)
  ) {
    throw new MigrationExecutionError('APP_MIGRATION_STATE_UNSUPPORTED')
  }
  if (!value.executions.every(isPersistedExecution)) {
    throw new MigrationExecutionError('APP_MIGRATION_STATE_INVALID')
  }

  const executionKeys = value.executions.map(execution =>
    JSON.stringify([
      execution.scopeId,
      execution.phase,
      execution.migrationId,
      execution.migrationVersion,
    ])
  )
  if (new Set(executionKeys).size !== executionKeys.length) {
    throw new MigrationExecutionError('APP_MIGRATION_STATE_INVALID')
  }
  return value as PersistedMigrationState
}

const isTerminal = (status: MigrationExecutionStatus): boolean =>
  status === 'completed' || status === 'abandoned-after-failure'

const clonePlan = (plan: MigrationPlan): MigrationPlan =>
  JSON.parse(JSON.stringify(plan)) as MigrationPlan

const toSnapshot = (execution: PersistedMigrationExecution): MigrationSnapshot => ({
  status: execution.status,
  migrationId: execution.migrationId,
  migrationVersion: execution.migrationVersion,
  plan: clonePlan(execution.plan),
  completedStepIds: [...execution.completedStepIds],
  completedCleanupStepIds: [...execution.completedCleanupStepIds],
  cleanupOutcome: execution.cleanupOutcome,
  currentStepId: execution.currentStepId,
  currentCleanupStepId: execution.currentCleanupStepId,
  errorCode: execution.errorCode,
  isResuming:
    (execution.status !== 'detected' && execution.status !== 'awaiting-confirmation') ||
    execution.completedStepIds.length > 0,
})

const getErrorCode = (error: unknown): string =>
  error instanceof MigrationExecutionError ? error.code : 'APP_MIGRATION_UNEXPECTED_ERROR'

const assertValidPlan = (plan: MigrationPlan): void => {
  if (!isMigrationPlan(plan)) {
    throw new MigrationExecutionError('APP_MIGRATION_PLAN_INVALID')
  }
}

export const createAppMigrationOrchestrator = <TContext extends MigrationContext>({
  migrations,
  store,
  now = Date.now,
  onEvent,
}: AppMigrationOrchestratorOptions<TContext>): AppMigrationOrchestrator<TContext> => {
  const migrationKeys = migrations.map(migration =>
    JSON.stringify([migration.phase, migration.id, migration.version])
  )
  const migrationOrders = new Map<string, number>()
  const hasConflictingOrders = migrations.some(migration => {
    const key = JSON.stringify([migration.phase, migration.id])
    const registeredOrder = migrationOrders.get(key)
    migrationOrders.set(key, migration.order)
    return typeof registeredOrder !== 'undefined' && registeredOrder !== migration.order
  })
  if (
    new Set(migrationKeys).size !== migrationKeys.length ||
    hasConflictingOrders ||
    migrations.some(
      migration =>
        !migration.id.trim() ||
        !Number.isInteger(migration.version) ||
        migration.version < 1 ||
        !Number.isFinite(migration.order)
    )
  ) {
    throw new MigrationExecutionError('APP_MIGRATION_REGISTRY_INVALID')
  }

  const orderedMigrations = [...migrations].sort(
    (left, right) =>
      left.order - right.order ||
      left.phase.localeCompare(right.phase) ||
      left.id.localeCompare(right.id) ||
      left.version - right.version
  )
  const loadState = async (context: TContext): Promise<PersistedMigrationState> => {
    const state = parseState(await store.load())
    const hasUnknownNonTerminalExecution = state.executions.some(
      execution =>
        execution.scopeId === context.scopeId &&
        execution.phase === context.phase &&
        !isTerminal(execution.status) &&
        !orderedMigrations.some(
          migration =>
            migration.id === execution.migrationId &&
            migration.version === execution.migrationVersion &&
            migration.phase === execution.phase
        )
    )
    if (hasUnknownNonTerminalExecution) {
      throw new MigrationExecutionError('APP_MIGRATION_DEFINITION_MISSING')
    }
    return state
  }
  const touchExecution = (execution: PersistedMigrationExecution): void => {
    execution.updatedAt = Math.max(now(), execution.createdAt, execution.updatedAt)
  }
  const emitEvent = (
    migration: AppMigrationDefinition<TContext>,
    name: MigrationEventName,
    details: Pick<MigrationEvent, 'stepId' | 'resourceId' | 'errorCode'> = {}
  ): void => {
    try {
      onEvent?.({
        name,
        migrationId: migration.id,
        migrationVersion: migration.version,
        phase: migration.phase,
        ...details,
      })
    } catch {}
  }

  const findExecution = (
    state: PersistedMigrationState,
    migration: AppMigrationDefinition<TContext>,
    context: TContext
  ): PersistedMigrationExecution | undefined =>
    state.executions.find(
      execution =>
        execution.scopeId === context.scopeId &&
        execution.phase === migration.phase &&
        execution.migrationId === migration.id &&
        execution.migrationVersion === migration.version
    )

  const getOrCreateExecution = async (
    state: PersistedMigrationState,
    migration: AppMigrationDefinition<TContext>,
    context: TContext
  ): Promise<PersistedMigrationExecution | null> => {
    const existing = findExecution(state, migration, context)
    if (existing && (!isTerminal(existing.status) || migration.completionPolicy !== 'recheck')) {
      return isTerminal(existing.status) ? null : existing
    }

    const plan = await migration.detect(context)
    if (!plan) return null
    assertValidPlan(plan)
    if (plan.cleanupSteps?.length && !migration.finalizeIdempotently) {
      throw new MigrationExecutionError('APP_MIGRATION_CLEANUP_HANDLER_MISSING')
    }

    const timestamp = now()
    const execution: PersistedMigrationExecution = {
      scopeId: context.scopeId,
      migrationId: migration.id,
      migrationVersion: migration.version,
      phase: migration.phase,
      status: 'detected',
      plan,
      completedStepIds: [],
      completedCleanupStepIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (existing) {
      state.executions[state.executions.indexOf(existing)] = execution
    } else {
      state.executions.push(execution)
    }
    await store.save(state)
    emitEvent(migration, 'detected')
    return execution
  }

  const emitSnapshot = (
    listener: MigrationSnapshotListener | undefined,
    snapshot: MigrationSnapshot
  ): void => {
    try {
      listener?.(
        snapshot.status === 'idle'
          ? snapshot
          : {
              ...snapshot,
              plan: clonePlan(snapshot.plan),
              completedStepIds: [...snapshot.completedStepIds],
              completedCleanupStepIds: [...snapshot.completedCleanupStepIds],
            }
      )
    } catch {}
  }

  const recordFailure = async ({
    state,
    migration,
    execution,
    error,
    onChange,
  }: {
    state: PersistedMigrationState
    migration: AppMigrationDefinition<TContext>
    execution: PersistedMigrationExecution
    error: unknown
    onChange?: MigrationSnapshotListener
  }): Promise<MigrationSnapshot> => {
    execution.status = 'failed'
    execution.errorCode = getErrorCode(error)
    if (typeof execution.currentStepId === 'undefined') {
      execution.currentStepId =
        execution.plan.steps[execution.completedStepIds.length]?.id ?? '__finalize__'
    }
    touchExecution(execution)
    await store.save(state)
    const snapshot = toSnapshot(execution)
    emitSnapshot(onChange, snapshot)
    const currentStep = execution.currentCleanupStepId
      ? execution.plan.cleanupSteps?.find(step => step.id === execution.currentCleanupStepId)
      : execution.plan.steps.find(step => step.id === execution.currentStepId)
    emitEvent(migration, 'failed', {
      stepId: execution.currentCleanupStepId ?? execution.currentStepId,
      resourceId: currentStep?.resourceId,
      errorCode: execution.errorCode,
    })
    return snapshot
  }

  const finalizeExecution = async ({
    state,
    migration,
    execution,
    context,
    outcome,
    onChange,
  }: {
    state: PersistedMigrationState
    migration: AppMigrationDefinition<TContext>
    execution: PersistedMigrationExecution
    context: TContext
    outcome: MigrationTerminalOutcome
    onChange?: MigrationSnapshotListener
  }): Promise<void> => {
    const cleanupSteps = execution.plan.cleanupSteps ?? []
    execution.currentStepId = '__finalize__'
    if (cleanupSteps.length > 0 && execution.cleanupOutcome !== outcome) {
      execution.completedCleanupStepIds = []
      execution.currentCleanupStepId = undefined
      execution.cleanupOutcome = outcome
    }
    touchExecution(execution)
    await store.save(state)

    const runCleanupStep = async (
      stepId: string,
      operation: (reportProgress: (update: MigrationProgressUpdate) => void) => Promise<void>
    ): Promise<void> => {
      if (execution.completedCleanupStepIds.includes(stepId)) return

      const nextStep = cleanupSteps[execution.completedCleanupStepIds.length]
      if (!nextStep || nextStep.id !== stepId) {
        throw new MigrationExecutionError('APP_MIGRATION_CLEANUP_ORDER_INVALID')
      }

      execution.currentCleanupStepId = stepId
      touchExecution(execution)
      await store.save(state)
      emitSnapshot(onChange, toSnapshot(execution))
      emitEvent(migration, 'cleanup-started', {
        stepId,
        resourceId: nextStep.resourceId,
      })

      await operation(update => {
        emitSnapshot(onChange, {
          ...toSnapshot(execution),
          progress: Math.max(0, Math.min(1, update.progress)),
          message: update.message,
        } as MigrationSnapshot)
      })

      execution.completedCleanupStepIds.push(stepId)
      execution.currentCleanupStepId = undefined
      touchExecution(execution)
      await store.save(state)
      emitSnapshot(onChange, toSnapshot(execution))
      emitEvent(migration, 'cleanup-completed', {
        stepId,
        resourceId: nextStep.resourceId,
      })
    }

    if (migration.finalizeIdempotently) {
      if (cleanupSteps.length === 0) emitEvent(migration, 'cleanup-started')
      await migration.finalizeIdempotently({
        context,
        plan: execution.plan,
        outcome,
        runCleanupStep,
      })
      if (cleanupSteps.length === 0) emitEvent(migration, 'cleanup-completed')
    }

    if (execution.completedCleanupStepIds.length !== cleanupSteps.length) {
      throw new MigrationExecutionError('APP_MIGRATION_CLEANUP_INCOMPLETE')
    }
  }

  const inspectUnlocked = async (context: TContext): Promise<MigrationSnapshot> => {
    const state = await loadState(context)

    for (const migration of orderedMigrations) {
      if (migration.phase !== context.phase) continue
      const execution = await getOrCreateExecution(state, migration, context)
      if (!execution) continue
      if (execution.status === 'detected') {
        execution.status = 'awaiting-confirmation'
        touchExecution(execution)
        await store.save(state)
      }
      return toSnapshot(execution)
    }

    return { status: 'idle', isResuming: false }
  }

  const runUnlocked = async (
    context: TContext,
    onChange?: MigrationSnapshotListener
  ): Promise<MigrationSnapshot> => {
    const state = await loadState(context)

    for (const migration of orderedMigrations) {
      if (migration.phase !== context.phase) continue
      const execution = findExecution(state, migration, context)
      if (!execution || isTerminal(execution.status)) continue
      if (execution.status === 'detected') {
        throw new MigrationExecutionError('APP_MIGRATION_CONFIRMATION_REQUIRED')
      }
      if (execution.status === 'abandoning-after-failure') {
        throw new MigrationExecutionError('APP_MIGRATION_ABANDON_IN_PROGRESS')
      }

      const isRetry = execution.status === 'failed'
      execution.status = 'running'
      execution.errorCode = undefined
      touchExecution(execution)
      await store.save(state)
      emitSnapshot(onChange, toSnapshot(execution))
      emitEvent(migration, isRetry ? 'retry' : 'started')

      try {
        for (const step of execution.plan.steps) {
          if (execution.completedStepIds.includes(step.id)) continue

          execution.currentStepId = step.id
          touchExecution(execution)
          await store.save(state)
          emitSnapshot(onChange, toSnapshot(execution))

          await migration.executeStep({
            context,
            plan: execution.plan,
            step,
            reportProgress(update) {
              emitSnapshot(onChange, {
                ...toSnapshot(execution),
                progress: Math.max(0, Math.min(1, update.progress)),
                message: update.message,
              } as MigrationSnapshot)
            },
          })

          execution.completedStepIds.push(step.id)
          execution.currentStepId = undefined
          touchExecution(execution)
          await store.save(state)
          emitSnapshot(onChange, toSnapshot(execution))
          emitEvent(migration, 'step-completed', {
            stepId: step.id,
            resourceId: step.resourceId,
          })
        }

        await finalizeExecution({
          state,
          migration,
          execution,
          context,
          outcome: 'completed',
          onChange,
        })

        execution.status = 'completed'
        execution.currentStepId = undefined
        execution.currentCleanupStepId = undefined
        touchExecution(execution)
        await store.save(state)
        const snapshot = toSnapshot(execution)
        emitSnapshot(onChange, snapshot)
        emitEvent(migration, 'completed')
        return snapshot
      } catch (error) {
        return recordFailure({ state, migration, execution, error, onChange })
      }
    }

    return { status: 'idle', isResuming: false }
  }

  const abandonUnlocked = async (
    context: TContext,
    onChange?: MigrationSnapshotListener
  ): Promise<MigrationSnapshot> => {
    const state = await loadState(context)
    for (const migration of orderedMigrations) {
      if (migration.phase !== context.phase) continue
      const execution = findExecution(state, migration, context)
      if (!execution || isTerminal(execution.status)) continue
      if (execution.status !== 'failed' && execution.status !== 'abandoning-after-failure') {
        throw new MigrationExecutionError('APP_MIGRATION_ABANDON_NOT_ALLOWED')
      }

      execution.status = 'abandoning-after-failure'
      execution.currentStepId = '__finalize__'
      if (execution.plan.cleanupSteps?.length) {
        if (execution.cleanupOutcome !== 'abandoned-after-failure') {
          execution.completedCleanupStepIds = []
          execution.currentCleanupStepId = undefined
        }
        execution.cleanupOutcome = 'abandoned-after-failure'
      }
      execution.errorCode = undefined
      touchExecution(execution)
      await store.save(state)

      try {
        await finalizeExecution({
          state,
          migration,
          execution,
          context,
          outcome: 'abandoned-after-failure',
          onChange,
        })
        execution.status = 'abandoned-after-failure'
        execution.currentStepId = undefined
        execution.currentCleanupStepId = undefined
        execution.errorCode = undefined
        touchExecution(execution)
        await store.save(state)
        const snapshot = toSnapshot(execution)
        emitSnapshot(onChange, snapshot)
        emitEvent(migration, 'abandoned-after-failure')
        return snapshot
      } catch (error) {
        execution.status = 'abandoning-after-failure'
        execution.currentStepId = '__finalize__'
        execution.errorCode = getErrorCode(error)
        touchExecution(execution)
        await store.save(state)
        const snapshot = toSnapshot(execution)
        emitSnapshot(onChange, snapshot)
        emitEvent(migration, 'failed', {
          stepId: execution.currentCleanupStepId ?? execution.currentStepId,
          resourceId: execution.plan.cleanupSteps?.find(
            step => step.id === execution.currentCleanupStepId
          )?.resourceId,
          errorCode: execution.errorCode,
        })
        return snapshot
      }
    }

    throw new MigrationExecutionError('APP_MIGRATION_ABANDON_NOT_ALLOWED')
  }

  return {
    inspect: context => store.runExclusive(() => inspectUnlocked(context)),
    run: (context, onChange) => store.runExclusive(() => runUnlocked(context, onChange)),
    abandon: (context, onChange) => store.runExclusive(() => abandonUnlocked(context, onChange)),
  }
}
