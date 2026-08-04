import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'

import {
  createLegacyResourceMigration,
  type LegacyResourceEvidence,
  type LegacyResourceMigrationDependencies,
  type LegacyResourceIdentity,
  type LegacyReplacementResource,
} from '../legacyResourceMigration'

const localContext = { phase: 'local' as const, scopeId: 'device' }

const identityKey = (identity: OfflineCopyIdentity): string => JSON.stringify(identity)

const createEvidence = (legacyIdentities: LegacyResourceIdentity[]): LegacyResourceEvidence => ({
  legacyIdentities,
  reclaimedBytes: 42,
})

const createDependencies = (
  overrides: Partial<LegacyResourceMigrationDependencies> = {}
): LegacyResourceMigrationDependencies => ({
  inspectEvidence: jest.fn(async () => createEvidence([])),
  resolveReplacementPlan: jest.fn(async request => [
    { identity: request, estimatedSize: 10, label: identityKey(request) },
  ]),
  isReplacementReady: jest.fn(async () => false),
  installReplacement: jest.fn(async () => {}),
  migratePersistedReferences: jest.fn(async () => {}),
  cleanupLegacyIdentity: jest.fn(async () => {}),
  finalizeCleanup: jest.fn(async () => {}),
  ...overrides,
})

describe('legacyResourceMigration', () => {
  it.each<[LegacyResourceIdentity, OfflineCopyIdentity]>([
    ['LSGS', { kind: 'strong-bible-index', versionId: 'LSG' }],
    ['KJVS', { kind: 'strong-bible-index', versionId: 'KJV' }],
    ['INT', { kind: 'interlinear-index', versionId: 'BHG', language: 'fr' }],
    ['INT_EN', { kind: 'interlinear-index', versionId: 'BHG', language: 'en' }],
    ['STRONG', { kind: 'strong-lexicon-module', moduleId: 'core' }],
  ])('maps %s to its replacement capability', async (legacyIdentity, replacementIdentity) => {
    const dependencies = createDependencies({
      inspectEvidence: jest.fn(async () => createEvidence([legacyIdentity])),
    })
    const migration = createLegacyResourceMigration(dependencies)

    const plan = await migration.detect(localContext)

    expect(dependencies.resolveReplacementPlan).toHaveBeenCalledWith(replacementIdentity)
    expect(plan).toMatchObject({
      steps: [
        { id: 'migrate-persisted-references' },
        { id: `install:${identityKey(replacementIdentity)}` },
      ],
      cleanupSteps: [
        { id: `cleanup:${legacyIdentity}`, resourceId: `legacy:${legacyIdentity}` },
        { id: 'cleanup:finalize' },
      ],
      metadata: {
        legacyIdentities: [legacyIdentity],
        reclaimedBytes: 42,
        estimatedDownloadBytes: 10,
      },
    })
  })

  it('deduplicates shared canonical prerequisites while preserving deterministic order', async () => {
    const bhg: LegacyReplacementResource = {
      identity: { kind: 'bible', versionId: 'BHG' },
      estimatedSize: 100,
      label: 'BHG',
    }
    const french: LegacyReplacementResource = {
      identity: { kind: 'interlinear-index', versionId: 'BHG', language: 'fr' },
      estimatedSize: 20,
      label: 'BHG FR',
    }
    const english: LegacyReplacementResource = {
      identity: { kind: 'interlinear-index', versionId: 'BHG', language: 'en' },
      estimatedSize: 30,
      label: 'BHG EN',
    }
    const dependencies = createDependencies({
      inspectEvidence: jest.fn(async () => createEvidence(['INT', 'INT_EN'])),
      resolveReplacementPlan: jest.fn(async request =>
        request.kind === 'interlinear-index' && request.language === 'fr'
          ? [bhg, french]
          : [bhg, english]
      ),
    })
    const migration = createLegacyResourceMigration(dependencies)

    const plan = await migration.detect(localContext)

    expect(plan?.steps.map(step => step.resourceId)).toEqual([
      'persisted-references',
      identityKey(bhg.identity),
      identityKey(french.identity),
      identityKey(english.identity),
    ])
    expect(plan?.metadata).toMatchObject({ estimatedDownloadBytes: 150 })
  })

  it('still migrates references and cleans legacy evidence when replacements are compatible', async () => {
    const dependencies = createDependencies({
      inspectEvidence: jest.fn(async () => createEvidence(['LSGS'])),
      resolveReplacementPlan: jest.fn(async () => []),
    })
    const migration = createLegacyResourceMigration(dependencies)

    const plan = await migration.detect(localContext)

    expect(plan?.steps).toEqual([
      {
        id: 'migrate-persisted-references',
        label: 'migration.legacyResources.references',
        resourceId: 'persisted-references',
      },
    ])
    expect(plan?.cleanupSteps?.map(step => step.id)).toEqual(['cleanup:LSGS', 'cleanup:finalize'])
  })

  it('does not create a migration without legacy filesystem, queue, publication or reference evidence', async () => {
    const dependencies = createDependencies()
    const migration = createLegacyResourceMigration(dependencies)

    await expect(migration.detect(localContext)).resolves.toBeNull()
  })

  it('rechecks compatibility before and after installing an atomic replacement', async () => {
    const replacement: LegacyReplacementResource = {
      identity: { kind: 'strong-lexicon-module', moduleId: 'core' },
      estimatedSize: 50,
      label: 'Lexique Strong',
    }
    let ready = false
    const dependencies = createDependencies({
      inspectEvidence: jest.fn(async () => createEvidence(['STRONG'])),
      resolveReplacementPlan: jest.fn(async () => [replacement]),
      isReplacementReady: jest.fn(async () => ready),
      installReplacement: jest.fn(async (_identity, reportProgress) => {
        reportProgress({ progress: 0.5, message: 'download' })
        ready = true
      }),
    })
    const migration = createLegacyResourceMigration(dependencies)
    const plan = (await migration.detect(localContext))!
    const progress = jest.fn()

    await migration.executeStep({
      context: localContext,
      plan,
      step: plan.steps[1],
      reportProgress: progress,
    })
    await migration.executeStep({
      context: localContext,
      plan,
      step: plan.steps[1],
      reportProgress: progress,
    })

    expect(dependencies.installReplacement).toHaveBeenCalledTimes(1)
    expect(progress).toHaveBeenCalledWith({ progress: 0.5, message: 'download' })
  })

  it('fails a step when installation does not produce a compatible replacement', async () => {
    const replacement: LegacyReplacementResource = {
      identity: { kind: 'strong-lexicon-module', moduleId: 'core' },
      estimatedSize: 50,
      label: 'Lexique Strong',
    }
    const dependencies = createDependencies({
      inspectEvidence: jest.fn(async () => createEvidence(['STRONG'])),
      resolveReplacementPlan: jest.fn(async () => [replacement]),
    })
    const migration = createLegacyResourceMigration(dependencies)
    const plan = (await migration.detect(localContext))!

    await expect(
      migration.executeStep({
        context: localContext,
        plan,
        step: plan.steps[1],
        reportProgress: jest.fn(),
      })
    ).rejects.toThrow('LEGACY_REPLACEMENT_NOT_COMPATIBLE')
  })

  it('checkpoints allowlisted cleanup identities before final migration cleanup', async () => {
    const dependencies = createDependencies({
      inspectEvidence: jest.fn(async () => createEvidence(['KJVS', 'STRONG'])),
      resolveReplacementPlan: jest.fn(async () => []),
    })
    const migration = createLegacyResourceMigration(dependencies)
    const plan = (await migration.detect(localContext))!
    const checkpoints: string[] = []

    await migration.finalizeIdempotently?.({
      context: localContext,
      plan,
      outcome: 'abandoned-after-failure',
      async runCleanupStep(stepId, operation) {
        checkpoints.push(stepId)
        await operation(jest.fn())
      },
    })

    expect(dependencies.cleanupLegacyIdentity).toHaveBeenNthCalledWith(
      1,
      'KJVS',
      'abandoned-after-failure'
    )
    expect(dependencies.cleanupLegacyIdentity).toHaveBeenNthCalledWith(
      2,
      'STRONG',
      'abandoned-after-failure'
    )
    expect(dependencies.finalizeCleanup).toHaveBeenCalledWith('abandoned-after-failure')
    expect(checkpoints).toEqual(['cleanup:KJVS', 'cleanup:STRONG', 'cleanup:finalize'])
  })
})
