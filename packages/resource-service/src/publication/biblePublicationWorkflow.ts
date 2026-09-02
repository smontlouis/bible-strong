import path from 'node:path'

export type BiblePublicationWorkflowOptions = {
  versionId: string
  sourcePath: string
  generatedAt: string
  activateProduction: boolean
  makerRoot?: string
  publicationRoot?: string
  workspacePath?: string
  dependentBundlePaths: string[]
}

export type BiblePublicationWorkflowStep =
  | 'package-bible-publication'
  | 'resolve-dependent-publications'
  | 'generate-exhaustive-offline-catalog'
  | 'validate-publication-set'
  | 'validate-r2-publication'
  | 'publish-r2-artifacts'
  | 'activate-neon-publications'
  | 'activate-offline-catalog'
  | 'deploy-resource-worker'
  | 'smoke-production'

export type BiblePublicationWorkflowOperation = (
  options: BiblePublicationWorkflowOptions
) => Promise<void>

export type BiblePublicationWorkflowOperations = {
  packageBiblePublication: BiblePublicationWorkflowOperation
  resolveDependentPublications: BiblePublicationWorkflowOperation
  generateOfflineCatalog: BiblePublicationWorkflowOperation
  validatePublicationSet: BiblePublicationWorkflowOperation
  validateR2Publication: BiblePublicationWorkflowOperation
  publishR2Artifacts: BiblePublicationWorkflowOperation
  activateNeonPublications: BiblePublicationWorkflowOperation
  activateOfflineCatalog: BiblePublicationWorkflowOperation
  deployResourceWorker: BiblePublicationWorkflowOperation
  smokeProduction: BiblePublicationWorkflowOperation
  compensateProductionActivation: (
    options: BiblePublicationWorkflowOptions,
    cause: unknown,
    completedSteps: readonly BiblePublicationWorkflowStep[]
  ) => Promise<void>
}

const requiredValue = (values: Map<string, string>, name: string): string => {
  const value = values.get(name)?.trim()
  if (!value) throw new Error(`BIBLE_PUBLICATION_OPTION_REQUIRED:${name}`)
  return value
}

export const parseBiblePublicationWorkflowArgs = (
  raw: readonly string[]
): BiblePublicationWorkflowOptions => {
  const values = new Map<string, string>()
  const dependentBundlePaths: string[] = []
  let activateProduction = false
  for (let index = 0; index < raw.length; index += 1) {
    const name = raw[index]
    if (name === '--activate-production') {
      activateProduction = true
      continue
    }
    if (
      !name ||
      ![
        '--version',
        '--source',
        '--generated-at',
        '--maker-root',
        '--publication-root',
        '--workspace',
        '--dependent-bundle',
        '--confirm-production',
      ].includes(name)
    ) {
      throw new Error(`BIBLE_PUBLICATION_OPTION_INVALID:${name ?? '<missing>'}`)
    }
    const value = raw[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`BIBLE_PUBLICATION_OPTION_VALUE_REQUIRED:${name}`)
    }
    if (name === '--dependent-bundle') {
      dependentBundlePaths.push(path.resolve(value))
    } else {
      if (values.has(name)) throw new Error(`BIBLE_PUBLICATION_OPTION_DUPLICATE:${name}`)
      values.set(name, value)
    }
    index += 1
  }

  const versionId = requiredValue(values, '--version').toUpperCase()
  const sourcePath = path.resolve(requiredValue(values, '--source'))
  const generatedAt = values.get('--generated-at') ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('BIBLE_PUBLICATION_GENERATED_AT_INVALID')
  }
  const productionConfirmation = values.get('--confirm-production')
  if (
    (activateProduction && productionConfirmation !== 'bible-strong.app') ||
    (!activateProduction && productionConfirmation !== undefined)
  ) {
    throw new Error('BIBLE_PUBLICATION_PRODUCTION_CONFIRMATION_REQUIRED')
  }
  return {
    versionId,
    sourcePath,
    generatedAt,
    activateProduction,
    dependentBundlePaths,
    ...(values.get('--maker-root') ? { makerRoot: path.resolve(values.get('--maker-root')!) } : {}),
    ...(values.get('--publication-root')
      ? { publicationRoot: path.resolve(values.get('--publication-root')!) }
      : {}),
    ...(values.get('--workspace')
      ? { workspacePath: path.resolve(values.get('--workspace')!) }
      : {}),
  }
}

export const createBiblePublicationPlan = (options: BiblePublicationWorkflowOptions) => {
  const preflightSteps: BiblePublicationWorkflowStep[] = [
    'package-bible-publication',
    'resolve-dependent-publications',
    'generate-exhaustive-offline-catalog',
    'validate-publication-set',
    'validate-r2-publication',
  ]
  const productionSteps: BiblePublicationWorkflowStep[] = [
    'publish-r2-artifacts',
    'activate-neon-publications',
    'activate-offline-catalog',
    'deploy-resource-worker',
    'smoke-production',
  ]
  return {
    versionId: options.versionId,
    sourcePath: options.sourcePath,
    generatedAt: options.generatedAt,
    mode: options.activateProduction ? ('production' as const) : ('preflight' as const),
    productionWrites: options.activateProduction,
    steps: options.activateProduction ? [...preflightSteps, ...productionSteps] : preflightSteps,
  }
}

export const executeBiblePublicationWorkflow = async (
  options: BiblePublicationWorkflowOptions,
  operations: BiblePublicationWorkflowOperations
) => {
  const plan = createBiblePublicationPlan(options)
  const operationByStep: Record<BiblePublicationWorkflowStep, BiblePublicationWorkflowOperation> = {
    'package-bible-publication': operations.packageBiblePublication,
    'resolve-dependent-publications': operations.resolveDependentPublications,
    'generate-exhaustive-offline-catalog': operations.generateOfflineCatalog,
    'validate-publication-set': operations.validatePublicationSet,
    'validate-r2-publication': operations.validateR2Publication,
    'publish-r2-artifacts': operations.publishR2Artifacts,
    'activate-neon-publications': operations.activateNeonPublications,
    'activate-offline-catalog': operations.activateOfflineCatalog,
    'deploy-resource-worker': operations.deployResourceWorker,
    'smoke-production': operations.smokeProduction,
  }
  const completedSteps: BiblePublicationWorkflowStep[] = []
  try {
    for (const step of plan.steps) {
      await operationByStep[step](options)
      completedSteps.push(step)
    }
  } catch (cause) {
    if (plan.productionWrites) {
      await operations.compensateProductionActivation(options, cause, completedSteps)
    }
    throw cause
  }
  return { ...plan, completedSteps }
}
