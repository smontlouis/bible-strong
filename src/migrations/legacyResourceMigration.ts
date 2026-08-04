import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'

import {
  MigrationExecutionError,
  type AppMigrationDefinition,
  type JsonValue,
  type MigrationContext,
  type MigrationProgressUpdate,
  type MigrationTerminalOutcome,
} from './appMigrationOrchestrator'

export const LEGACY_RESOURCE_MIGRATION_ID = 'legacy-bible-resources'

export type LegacyResourceIdentity = 'LSGS' | 'KJVS' | 'INT' | 'INT_EN' | 'STRONG'

export interface LegacyResourceEvidence {
  legacyIdentities: LegacyResourceIdentity[]
  reclaimedBytes?: number
}

export interface LegacyReplacementResource {
  identity: OfflineCopyIdentity
  estimatedSize?: number
  label: string
}

export interface LegacyResourceMigrationDependencies {
  inspectEvidence(): Promise<LegacyResourceEvidence>
  resolveReplacementPlan(request: OfflineCopyIdentity): Promise<LegacyReplacementResource[]>
  isReplacementReady(identity: OfflineCopyIdentity): Promise<boolean>
  installReplacement(
    identity: OfflineCopyIdentity,
    reportProgress: (update: MigrationProgressUpdate) => void
  ): Promise<void>
  migratePersistedReferences(): Promise<void>
  cleanupLegacyIdentity(
    identity: LegacyResourceIdentity,
    outcome: MigrationTerminalOutcome
  ): Promise<void>
  finalizeCleanup(outcome: MigrationTerminalOutcome): Promise<void>
}

const LEGACY_IDENTITY_ORDER: LegacyResourceIdentity[] = ['LSGS', 'KJVS', 'INT', 'INT_EN', 'STRONG']

const getReplacementRequest = (identity: LegacyResourceIdentity): OfflineCopyIdentity => {
  switch (identity) {
    case 'LSGS':
      return { kind: 'strong-bible-index', versionId: 'LSG' }
    case 'KJVS':
      return { kind: 'strong-bible-index', versionId: 'KJV' }
    case 'INT':
      return { kind: 'interlinear-index', versionId: 'BHG', language: 'fr' }
    case 'INT_EN':
      return { kind: 'interlinear-index', versionId: 'BHG', language: 'en' }
    case 'STRONG':
      return { kind: 'strong-lexicon-module', moduleId: 'core' }
  }
}

const identityKey = (identity: OfflineCopyIdentity): string => JSON.stringify(identity)

const serializeIdentity = (identity: OfflineCopyIdentity): { [key: string]: JsonValue } => {
  switch (identity.kind) {
    case 'bible':
      return { kind: identity.kind, versionId: identity.versionId }
    case 'strong-bible-index':
      return { kind: identity.kind, versionId: identity.versionId }
    case 'interlinear-index':
      return {
        kind: identity.kind,
        versionId: identity.versionId,
        language: identity.language,
      }
    case 'strong-lexicon-module':
      return { kind: identity.kind, moduleId: identity.moduleId }
    case 'database':
      return {
        kind: identity.kind,
        databaseId: identity.databaseId,
        language: identity.language,
      }
    case 'bible-pericope':
    case 'bible-red-words':
      return { kind: identity.kind, versionId: identity.versionId }
  }
}

const parseIdentity = (value: unknown): OfflineCopyIdentity => {
  if (!value || typeof value !== 'object' || !('kind' in value)) {
    throw new MigrationExecutionError('LEGACY_REPLACEMENT_IDENTITY_INVALID')
  }
  const identity = value as Record<string, unknown>
  switch (identity.kind) {
    case 'bible':
      if (typeof identity.versionId === 'string') {
        return { kind: identity.kind, versionId: identity.versionId }
      }
      break
    case 'strong-bible-index':
      if (identity.versionId === 'LSG' || identity.versionId === 'KJV') {
        return { kind: identity.kind, versionId: identity.versionId }
      }
      break
    case 'interlinear-index':
      if (
        identity.versionId === 'BHG' &&
        (identity.language === 'fr' || identity.language === 'en')
      ) {
        return { kind: identity.kind, versionId: 'BHG', language: identity.language }
      }
      break
    case 'strong-lexicon-module':
      if (identity.moduleId === 'core') {
        return { kind: identity.kind, moduleId: identity.moduleId }
      }
      break
  }
  throw new MigrationExecutionError('LEGACY_REPLACEMENT_IDENTITY_INVALID')
}

const parseLegacyIdentities = (value: unknown): LegacyResourceIdentity[] => {
  if (!Array.isArray(value)) {
    throw new MigrationExecutionError('LEGACY_RESOURCE_PLAN_INVALID')
  }
  const identities = value.filter(
    (identity): identity is LegacyResourceIdentity =>
      typeof identity === 'string' &&
      LEGACY_IDENTITY_ORDER.includes(identity as LegacyResourceIdentity)
  )
  if (identities.length !== value.length || new Set(identities).size !== identities.length) {
    throw new MigrationExecutionError('LEGACY_RESOURCE_PLAN_INVALID')
  }
  return identities
}

const orderLegacyIdentities = (identities: LegacyResourceIdentity[]): LegacyResourceIdentity[] =>
  LEGACY_IDENTITY_ORDER.filter(identity => identities.includes(identity))

export const createLegacyResourceMigration = (
  dependencies: LegacyResourceMigrationDependencies
): AppMigrationDefinition => ({
  id: LEGACY_RESOURCE_MIGRATION_ID,
  version: 1,
  phase: 'local',
  order: 100,
  async detect() {
    const evidence = await dependencies.inspectEvidence()
    const legacyIdentities = orderLegacyIdentities(evidence.legacyIdentities)
    if (legacyIdentities.length === 0) return null

    const replacements = new Map<string, LegacyReplacementResource>()
    for (const legacyIdentity of legacyIdentities) {
      const request = getReplacementRequest(legacyIdentity)
      const plannedResources = await dependencies.resolveReplacementPlan(request)
      for (const resource of plannedResources) {
        const key = identityKey(resource.identity)
        if (!replacements.has(key)) replacements.set(key, resource)
      }
    }

    const replacementSteps = [...replacements.values()].map(resource => ({
      id: `install:${identityKey(resource.identity)}`,
      label: resource.label,
      resourceId: identityKey(resource.identity),
      payload: { identity: serializeIdentity(resource.identity) },
    }))
    const estimatedDownloadBytes = [...replacements.values()].reduce(
      (total, resource) => total + (resource.estimatedSize ?? 0),
      0
    )

    return {
      steps: [
        {
          id: 'migrate-persisted-references',
          label: 'migration.legacyResources.references',
          resourceId: 'persisted-references',
        },
        ...replacementSteps,
      ],
      cleanupSteps: [
        ...legacyIdentities.map(identity => ({
          id: `cleanup:${identity}`,
          label: 'migration.legacyResources.cleanupResource',
          resourceId: `legacy:${identity}`,
          payload: { legacyIdentity: identity },
        })),
        {
          id: 'cleanup:finalize',
          label: 'migration.legacyResources.cleanupFinalize',
          resourceId: 'legacy:finalize',
        },
      ],
      metadata: {
        legacyIdentities,
        reclaimedBytes: evidence.reclaimedBytes ?? 0,
        estimatedDownloadBytes,
      },
    }
  },
  async executeStep({ step, reportProgress }) {
    if (step.id === 'migrate-persisted-references') {
      await dependencies.migratePersistedReferences()
      return
    }

    const identity = parseIdentity(step.payload?.identity)
    if (await dependencies.isReplacementReady(identity)) return
    await dependencies.installReplacement(identity, reportProgress)
    if (!(await dependencies.isReplacementReady(identity))) {
      throw new MigrationExecutionError('LEGACY_REPLACEMENT_NOT_COMPATIBLE')
    }
  },
  async finalizeIdempotently({ plan, outcome, runCleanupStep }) {
    const legacyIdentities = parseLegacyIdentities(plan.metadata?.legacyIdentities)
    for (const legacyIdentity of legacyIdentities) {
      await runCleanupStep(`cleanup:${legacyIdentity}`, async () => {
        await dependencies.cleanupLegacyIdentity(legacyIdentity, outcome)
      })
    }
    await runCleanupStep('cleanup:finalize', async () => {
      await dependencies.finalizeCleanup(outcome)
    })
  },
})

export const isLegacyResourceMigrationContext = (
  context: MigrationContext
): context is MigrationContext & { phase: 'local' } => context.phase === 'local'
