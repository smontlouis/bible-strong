import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { access, copyFile, cp, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  acquireLocalDatabaseAdvisoryLock,
  assertLocalDatabaseReachable,
} from '../database/localDatabase'
import {
  executeBiblePublicationWorkflow,
  parseBiblePublicationWorkflowArgs,
  type BiblePublicationWorkflowOperations,
} from './biblePublicationWorkflow'
import {
  buildBiblePublicationOverlay,
  describeBiblePublicationBundle,
  type BiblePublicationOverlay,
} from './biblePublicationSet'
import { findPublicationBundlesRecursively } from './publicationCatalog'
import { formatPublicationCliFailure, resolveCatalogImportPolicy } from './publicationCliPolicy'
import {
  immutableR2ArtifactKey,
  publishR2PublicationCatalog,
  validateR2PublicationCatalog,
} from './r2ArtifactPublisher'
import { validatePublicationBundle } from './publicationBundle'
import { WranglerR2ArtifactStore } from './wranglerR2ArtifactStore'

const EXPECTED_RESOURCE_COUNT = 72
const PRODUCTION_PUBLICATION_LOCK_ID = '204116128917'

const runCommand = async (
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`BIBLE_PUBLICATION_COMMAND_FAILED:${command}:${code ?? signal}`))
    })
  })

const readCommandOutput = async (
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'ignore'] })
    const stdout: Buffer[] = []
    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)))
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8').trim())
      else reject(new Error(`BIBLE_PUBLICATION_COMMAND_FAILED:${command}:${code ?? signal}`))
    })
  })

const requireEnvironment = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`BIBLE_PUBLICATION_ENV_REQUIRED:${name}`)
  return value
}

const ensureFile = async (filePath: string, code: string) => {
  const details = await stat(filePath).catch(() => undefined)
  if (!details?.isFile()) throw new Error(`${code}:${filePath}`)
}

const writeJson = (filePath: string, value: unknown) =>
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)

const environmentWithout = (...excluded: readonly string[]): NodeJS.ProcessEnv => {
  const environment = { ...process.env }
  for (const name of excluded) delete environment[name]
  return environment
}

const buildEnvironment = () =>
  environmentWithout(
    'RESOURCE_DATABASE_URL',
    'RESOURCE_APP_CHECK_DEBUG_TOKEN',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID'
  )

const neonEnvironment = () =>
  environmentWithout(
    'RESOURCE_APP_CHECK_DEBUG_TOKEN',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID'
  )

const cloudflareEnvironment = () =>
  environmentWithout('RESOURCE_DATABASE_URL', 'RESOURCE_APP_CHECK_DEBUG_TOKEN')

export const mintResourceAppCheckToken = async (
  environment: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch
) => {
  const required = (name: string) => {
    const value = environment[name]?.trim()
    if (!value) throw new Error(`BIBLE_PUBLICATION_ENV_REQUIRED:${name}`)
    return value
  }
  const projectId = required('RESOURCE_FIREBASE_PROJECT_ID')
  const appId = required('RESOURCE_FIREBASE_APP_ID')
  const apiKey = required('RESOURCE_FIREBASE_API_KEY')
  const debugToken = required('RESOURCE_APP_CHECK_DEBUG_TOKEN')
  const endpoint = new URL(
    `https://firebaseappcheck.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/apps/${appId}:exchangeDebugToken`
  )
  endpoint.searchParams.set('key', apiKey)
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debugToken }),
  })
  if (!response.ok) throw new Error(`BIBLE_PUBLICATION_APP_CHECK_MINT_FAILED:${response.status}`)
  const payload = (await response.json()) as { token?: string }
  if (!payload.token) throw new Error('BIBLE_PUBLICATION_APP_CHECK_TOKEN_MISSING')
  return payload.token
}

type RawMobileCatalogEntry = {
  id: string
  url: string
  file: string
  archiveSha256: string
  archiveBytes: number
  resourceRevision?: string
  coreRevision?: string
  [key: string]: unknown
}

type RawMobileCatalog = {
  resourceCount: number
  resources: Record<string, RawMobileCatalogEntry>
}

const readRawCatalog = async (catalogPath: string): Promise<RawMobileCatalog> =>
  JSON.parse(await readFile(catalogPath, 'utf8')) as RawMobileCatalog

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export const resourceApiRoute = (catalogId: string, probe: { book: number; chapter: number }) => {
  const [kind, versionId, language] = catalogId.split(':')
  const reference = `books/${probe.book}/chapters/${probe.chapter}`
  if (kind === 'bible') return `/v1/bibles/${encodeURIComponent(versionId)}/${reference}`
  if (kind === 'bible-strong') {
    return `/v1/strong-bibles/${encodeURIComponent(versionId)}/${reference}`
  }
  if (kind === 'bible-interlinear') {
    return `/v1/interlinear-bibles/${encodeURIComponent(versionId)}/languages/${encodeURIComponent(language)}/${reference}`
  }
  return undefined
}

type WorkflowState = {
  appRoot: string
  makerRoot: string
  publicationRoot: string
  workspacePath: string
  ordinaryOutputPath: string
  catalogOutputPath: string
  catalogPath: string
  sourceOverridesPath: string
  catalogOverridesPath: string
  catalogBackupPath: string
  baselineSnapshotPath: string
  candidateBundlePaths: string[]
  baselineBundlePaths: string[]
  neonActivated: boolean
  catalogActivated: boolean
  workerDeploymentAttempted: boolean
  overlay?: BiblePublicationOverlay
}

const createState = async (
  appRoot: string,
  options: ReturnType<typeof parseBiblePublicationWorkflowArgs>
): Promise<WorkflowState> => {
  const makerRoot = options.makerRoot ?? path.resolve(appRoot, '../bible-lexicon-maker')
  const publicationRoot =
    options.publicationRoot ?? path.join(makerRoot, 'outputs/resource-publications')
  const safeDate = options.generatedAt.replace(/[^0-9A-Za-z]+/g, '-')
  const workspacePath =
    options.workspacePath ??
    path.join(
      appRoot,
      '.local/publication-workflows',
      `${options.versionId.toLowerCase()}-${safeDate}`
    )
  await ensureFile(options.sourcePath, 'BIBLE_PUBLICATION_SOURCE_MISSING')
  await ensureFile(path.join(makerRoot, 'package.json'), 'BIBLE_PUBLICATION_MAKER_MISSING')
  await access(publicationRoot).catch(() => {
    throw new Error(`BIBLE_PUBLICATION_BASELINE_MISSING:${publicationRoot}`)
  })
  await mkdir(path.dirname(workspacePath), { recursive: true, mode: 0o700 })
  await mkdir(workspacePath, { recursive: false, mode: 0o700 })
  return {
    appRoot,
    makerRoot,
    publicationRoot,
    workspacePath,
    ordinaryOutputPath: path.join(workspacePath, 'ordinary-bibles'),
    catalogOutputPath: path.join(workspacePath, 'mobile-resources'),
    catalogPath: path.join(workspacePath, 'mobile-resources/mobile-resource-catalog.json'),
    sourceOverridesPath: path.join(workspacePath, 'source-overrides.json'),
    catalogOverridesPath: path.join(workspacePath, 'catalog-overrides.json'),
    catalogBackupPath: path.join(workspacePath, 'mobile-resource-catalog.previous.json'),
    baselineSnapshotPath: path.join(workspacePath, 'verified-publication-baseline'),
    candidateBundlePaths: [],
    baselineBundlePaths: [],
    neonActivated: false,
    catalogActivated: false,
    workerDeploymentAttempted: false,
  }
}

const createOperations = (
  state: WorkflowState,
  options: ReturnType<typeof parseBiblePublicationWorkflowArgs>
): BiblePublicationWorkflowOperations => ({
  packageBiblePublication: async () => {
    await writeJson(state.sourceOverridesPath, {
      [`bible:${options.versionId}`]: { canonical: options.sourcePath },
    })
    await runCommand(
      'yarn',
      [
        'resources:publication:bibles',
        '--generated-at',
        options.generatedAt,
        '--version',
        options.versionId,
        '--source-overrides',
        state.sourceOverridesPath,
        '--output',
        state.ordinaryOutputPath,
      ],
      state.makerRoot,
      buildEnvironment()
    )
    const generated = await findPublicationBundlesRecursively([state.ordinaryOutputPath])
    if (generated.length !== 1) {
      throw new Error(`BIBLE_PUBLICATION_TARGET_BUILD_COUNT_MISMATCH:${generated.length}:1`)
    }
    state.candidateBundlePaths = generated
  },

  resolveDependentPublications: async () => {
    const dependentBundles = options.dependentBundlePaths.length
      ? await findPublicationBundlesRecursively(options.dependentBundlePaths)
      : []
    state.candidateBundlePaths.push(...dependentBundles)
    const baselineBundles = await findPublicationBundlesRecursively([state.publicationRoot])
    state.baselineBundlePaths = baselineBundles
    state.overlay = await buildBiblePublicationOverlay(
      baselineBundles,
      state.candidateBundlePaths,
      options.versionId,
      EXPECTED_RESOURCE_COUNT
    )
  },

  generateOfflineCatalog: async () => {
    if (!state.overlay) throw new Error('BIBLE_PUBLICATION_OVERLAY_MISSING')
    const overrides: Record<string, { canonical: string }> = {
      [`bible:${options.versionId}`]: { canonical: options.sourcePath },
    }
    for (const bundlePath of state.overlay.changedBundlePaths) {
      const description = await describeBiblePublicationBundle(bundlePath)
      if (description.catalogId === `bible:${options.versionId}`) continue
      const validated = await validatePublicationBundle(bundlePath)
      overrides[description.catalogId] = { canonical: validated.offlineArtifactPath }
    }
    await writeJson(state.catalogOverridesPath, overrides)
    await runCommand(
      'yarn',
      [
        'resources:release:mobile',
        '--generated-at',
        options.generatedAt,
        '--source-overrides',
        state.catalogOverridesPath,
        '--output-dir',
        state.catalogOutputPath,
      ],
      state.makerRoot,
      buildEnvironment()
    )
  },

  validatePublicationSet: async () => {
    if (!state.overlay) throw new Error('BIBLE_PUBLICATION_OVERLAY_MISSING')
    if (state.overlay.bundlePaths.length !== EXPECTED_RESOURCE_COUNT) {
      throw new Error(
        `BIBLE_PUBLICATION_OVERLAY_COUNT_MISMATCH:${state.overlay.bundlePaths.length}:${EXPECTED_RESOURCE_COUNT}`
      )
    }
    await mkdir(state.baselineSnapshotPath)
    const snapshotIndex: Record<string, string> = {}
    for (const bundlePath of state.overlay.bundlePaths) {
      const description = await describeBiblePublicationBundle(bundlePath)
      const directoryName = description.catalogId.replace(/[^0-9A-Za-z._-]+/g, '_')
      await cp(bundlePath, path.join(state.baselineSnapshotPath, directoryName), {
        recursive: true,
        errorOnExist: true,
      })
      snapshotIndex[description.catalogId] = directoryName
    }
    await writeJson(path.join(state.baselineSnapshotPath, 'index.json'), snapshotIndex)
  },

  validateR2Publication: async () => {
    if (!state.overlay) throw new Error('BIBLE_PUBLICATION_OVERLAY_MISSING')
    if (options.activateProduction) {
      const databasePolicy = resolveCatalogImportPolicy({
        mode: 'hosted',
        connectionString: requireEnvironment('RESOURCE_DATABASE_URL'),
      })
      await assertLocalDatabaseReachable({
        connectionString: databasePolicy.connectionString,
        maxConnections: 1,
      })
      const bucket = requireEnvironment('RESOURCE_R2_BUCKET')
      const appCheckToken = await mintResourceAppCheckToken()
      await runCommand(
        'git',
        ['diff', '--quiet', 'HEAD', '--', '.'],
        state.appRoot,
        buildEnvironment()
      )
      const currentBranch = await readCommandOutput(
        'git',
        ['branch', '--show-current'],
        state.appRoot,
        buildEnvironment()
      )
      if (currentBranch !== 'master')
        throw new Error('BIBLE_PUBLICATION_PRODUCTION_BRANCH_REQUIRED')
      await runCommand(
        'git',
        ['fetch', '--no-tags', 'origin', 'master'],
        state.appRoot,
        buildEnvironment()
      )
      const [localRevision, productionRevision] = await Promise.all([
        readCommandOutput('git', ['rev-parse', 'HEAD'], state.appRoot, buildEnvironment()),
        readCommandOutput('git', ['rev-parse', 'origin/master'], state.appRoot, buildEnvironment()),
      ])
      if (localRevision !== productionRevision) {
        throw new Error('BIBLE_PUBLICATION_PRODUCTION_REVISION_REQUIRED')
      }
      const untrackedFiles = await readCommandOutput(
        'git',
        ['ls-files', '--others', '--exclude-standard'],
        state.appRoot,
        buildEnvironment()
      )
      if (untrackedFiles) throw new Error('BIBLE_PUBLICATION_WORKTREE_UNTRACKED')
      const currentCatalog = path.join(state.appRoot, 'src/assets/mobile-resource-catalog.json')
      await copyFile(currentCatalog, state.catalogBackupPath)
      const [currentCatalogJson, candidateCatalogJson] = await Promise.all([
        readRawCatalog(currentCatalog),
        readRawCatalog(state.catalogPath),
      ])
      const liveCatalogResponse = await fetch('https://api.bible-strong.app/v1/offline-catalog')
      if (!liveCatalogResponse.ok) {
        throw new Error(`BIBLE_PUBLICATION_LIVE_CATALOG_FAILED:${liveCatalogResponse.status}`)
      }
      const liveCatalog = (await liveCatalogResponse.json()) as RawMobileCatalog
      if (
        liveCatalog.resourceCount !== EXPECTED_RESOURCE_COUNT ||
        stableJson(liveCatalog.resources) !== stableJson(currentCatalogJson.resources)
      ) {
        throw new Error('BIBLE_PUBLICATION_LIVE_CATALOG_BASELINE_MISMATCH')
      }
      if (candidateCatalogJson.resourceCount !== EXPECTED_RESOURCE_COUNT) {
        throw new Error('BIBLE_PUBLICATION_CANDIDATE_CATALOG_COUNT_MISMATCH')
      }
      const baselineCandidates = await validateR2PublicationCatalog(
        state.baselineBundlePaths,
        currentCatalog,
        { expectedCatalogResourceCount: EXPECTED_RESOURCE_COUNT }
      )
      await validateR2PublicationCatalog(state.overlay.bundlePaths, state.catalogPath, {
        expectedCatalogResourceCount: EXPECTED_RESOURCE_COUNT,
      })
      const rollbackCandidates = baselineCandidates.filter(candidate =>
        state.overlay?.changedCatalogIds.includes(candidate.catalogId)
      )
      if (rollbackCandidates.length !== state.overlay.previousBundlePaths.length) {
        throw new Error('BIBLE_PUBLICATION_R2_ROLLBACK_SET_MISMATCH')
      }
      const r2 = new WranglerR2ArtifactStore({
        bucket,
        env: cloudflareEnvironment(),
      })
      for (const candidate of rollbackCandidates) {
        const expected = candidate.validated.manifest.offlineArtifact
        const currentEntry = currentCatalogJson.resources[candidate.catalogId]
        if (!currentEntry) {
          throw new Error(`BIBLE_PUBLICATION_CURRENT_CATALOG_MISSING:${candidate.catalogId}`)
        }
        const catalogSha256 = new URL(currentEntry.url).searchParams.get('sha256')
        if (catalogSha256 && catalogSha256 !== expected.sha256) {
          throw new Error(`BIBLE_PUBLICATION_CURRENT_CATALOG_SHA_MISMATCH:${candidate.catalogId}`)
        }
        const key = catalogSha256
          ? immutableR2ArtifactKey(candidate.stableKey, catalogSha256)
          : candidate.stableKey
        const [artifactBytes, metadataBytes] = await Promise.all([
          r2.get(key),
          r2.get(`${key}.metadata.json`),
        ])
        if (!artifactBytes || !metadataBytes) {
          throw new Error(`BIBLE_PUBLICATION_R2_BASELINE_MISSING:${candidate.catalogId}`)
        }
        const metadata = JSON.parse(metadataBytes.toString('utf8')) as {
          key?: string
          bytes?: number
          sha256?: string
        }
        if (
          metadata.key !== key ||
          metadata.bytes !== expected.bytes ||
          metadata.sha256 !== expected.sha256 ||
          artifactBytes.byteLength !== expected.bytes ||
          createHash('sha256').update(artifactBytes).digest('hex') !== expected.sha256
        ) {
          throw new Error(`BIBLE_PUBLICATION_R2_BASELINE_MISMATCH:${candidate.catalogId}`)
        }
      }
      for (const previousBundlePath of state.overlay.previousBundlePaths) {
        const description = await describeBiblePublicationBundle(previousBundlePath)
        if (!description.probe) {
          throw new Error(`BIBLE_PUBLICATION_BASELINE_PROBE_MISSING:${description.catalogId}`)
        }
        const route = resourceApiRoute(description.catalogId, description.probe)
        if (!route) continue
        const response = await fetch(`https://api.bible-strong.app${route}`, {
          headers: { 'X-Firebase-AppCheck': appCheckToken },
        })
        if (!response.ok) {
          throw new Error(
            `BIBLE_PUBLICATION_NEON_BASELINE_READ_FAILED:${description.catalogId}:${response.status}`
          )
        }
        const payload = (await response.json()) as {
          resource?: { revision?: string; textRevision?: string }
        }
        const liveRevision = payload.resource?.textRevision ?? payload.resource?.revision
        if (liveRevision !== description.revision) {
          throw new Error(`BIBLE_PUBLICATION_NEON_BASELINE_MISMATCH:${description.catalogId}`)
        }
      }
      await runCommand('yarn', ['wrangler', 'whoami'], state.appRoot, cloudflareEnvironment())
      return
    }
    await validateR2PublicationCatalog(state.overlay.bundlePaths, state.catalogPath, {
      expectedCatalogResourceCount: EXPECTED_RESOURCE_COUNT,
    })
  },

  publishR2Artifacts: async () => {
    if (!state.overlay) throw new Error('BIBLE_PUBLICATION_OVERLAY_MISSING')
    const bucket = requireEnvironment('RESOURCE_R2_BUCKET')
    await publishR2PublicationCatalog(
      state.overlay.changedBundlePaths,
      state.catalogPath,
      new WranglerR2ArtifactStore({ bucket, env: cloudflareEnvironment() }),
      {
        expectedCatalogResourceCount: EXPECTED_RESOURCE_COUNT,
        bundleSelection: 'changed',
        onResult: (result, index, total) => {
          const detail = result.status === 'skipped' ? result.reason : result.key
          console.error(
            `[R2 ${index}/${total}] ${result.status}: ${result.resourceIdentity} (${detail})`
          )
        },
      }
    )
  },

  activateNeonPublications: async () => {
    if (!state.overlay) throw new Error('BIBLE_PUBLICATION_OVERLAY_MISSING')
    try {
      await runCommand(
        'yarn',
        [
          'resources:import-catalog:hosted',
          ...state.overlay.changedBundlePaths.flatMap(bundlePath => ['--root', bundlePath]),
        ],
        state.appRoot,
        neonEnvironment()
      )
    } catch (cause) {
      try {
        await runCommand(
          'yarn',
          [
            'resources:import-catalog:hosted',
            ...state.overlay.previousBundlePaths.flatMap(bundlePath => ['--root', bundlePath]),
          ],
          state.appRoot,
          neonEnvironment()
        )
      } catch (rollbackCause) {
        throw new Error('BIBLE_PUBLICATION_NEON_ROLLBACK_FAILED', {
          cause: new AggregateError([cause, rollbackCause]),
        })
      }
      throw new Error('BIBLE_PUBLICATION_NEON_ACTIVATION_ROLLED_BACK', { cause })
    }
    state.neonActivated = true
  },

  activateOfflineCatalog: async () => {
    const destination = path.join(state.appRoot, 'src/assets/mobile-resource-catalog.json')
    const temporary = `${destination}.tmp-${process.pid}-${randomUUID()}`
    await copyFile(state.catalogPath, temporary)
    await rename(temporary, destination)
    state.catalogActivated = true
  },

  deployResourceWorker: async () => {
    state.workerDeploymentAttempted = true
    await runCommand('yarn', ['resources:worker:deploy'], state.appRoot, cloudflareEnvironment())
  },

  smokeProduction: async () => {
    const apiBaseUrl = 'https://api.bible-strong.app'
    const health = await fetch(`${apiBaseUrl}/health`)
    if (!health.ok) throw new Error(`BIBLE_PUBLICATION_SMOKE_HEALTH_FAILED:${health.status}`)
    const catalogResponse = await fetch(`${apiBaseUrl}/v1/offline-catalog`)
    if (!catalogResponse.ok) {
      throw new Error(`BIBLE_PUBLICATION_SMOKE_CATALOG_FAILED:${catalogResponse.status}`)
    }
    const remoteCatalog = (await catalogResponse.json()) as RawMobileCatalog
    const localCatalog = await readRawCatalog(state.catalogPath)
    const catalogId = `bible:${options.versionId}`
    if (
      remoteCatalog.resources?.[catalogId]?.archiveSha256 !==
      localCatalog.resources[catalogId]?.archiveSha256
    ) {
      throw new Error(`BIBLE_PUBLICATION_SMOKE_CATALOG_MISMATCH:${catalogId}`)
    }
    const targetArtifact = localCatalog.resources[catalogId]
    if (!targetArtifact) throw new Error(`BIBLE_PUBLICATION_SMOKE_CATALOG_MISSING:${catalogId}`)
    const artifact = await fetch(targetArtifact.url)
    if (artifact.status !== 401) {
      throw new Error(`BIBLE_PUBLICATION_SMOKE_ARTIFACT_AUTH_FAILED:${artifact.status}`)
    }
    if (!state.overlay) throw new Error('BIBLE_PUBLICATION_OVERLAY_MISSING')
    const appCheckToken = await mintResourceAppCheckToken()
    for (const changedCatalogId of state.overlay.changedCatalogIds) {
      const entry = localCatalog.resources[changedCatalogId]
      if (!entry) throw new Error(`BIBLE_PUBLICATION_SMOKE_CATALOG_MISSING:${changedCatalogId}`)
      const response = await fetch(entry.url, {
        headers: { 'X-Firebase-AppCheck': appCheckToken },
      })
      if (!response.ok) {
        throw new Error(
          `BIBLE_PUBLICATION_SMOKE_ARTIFACT_READ_FAILED:${changedCatalogId}:${response.status}`
        )
      }
      const bytes = Buffer.from(await response.arrayBuffer())
      if (
        bytes.byteLength !== entry.archiveBytes ||
        createHash('sha256').update(bytes).digest('hex') !== entry.archiveSha256
      ) {
        throw new Error(`BIBLE_PUBLICATION_SMOKE_ARTIFACT_INTEGRITY_FAILED:${changedCatalogId}`)
      }
    }
    const changedDescriptions = await Promise.all(
      state.overlay.changedBundlePaths.map(describeBiblePublicationBundle)
    )
    const targetDescription = changedDescriptions.find(
      description => description.catalogId === `bible:${options.versionId}`
    )
    if (!targetDescription) throw new Error('BIBLE_PUBLICATION_TARGET_BUNDLE_MISSING')
    if (!targetDescription.probe) throw new Error('BIBLE_PUBLICATION_TARGET_PROBE_MISSING')
    const targetRoute = resourceApiRoute(targetDescription.catalogId, targetDescription.probe)
    if (!targetRoute) throw new Error('BIBLE_PUBLICATION_TARGET_ROUTE_MISSING')
    const chapter = await fetch(`${apiBaseUrl}${targetRoute}`, {
      headers: { 'X-Firebase-AppCheck': appCheckToken },
    })
    if (!chapter.ok) {
      throw new Error(`BIBLE_PUBLICATION_SMOKE_AUTHENTICATED_READ_FAILED:${chapter.status}`)
    }
    const chapterPayload = (await chapter.json()) as {
      resource?: { textRevision?: string }
    }
    if (chapterPayload.resource?.textRevision !== state.overlay.bibleRevision) {
      throw new Error(
        `BIBLE_PUBLICATION_SMOKE_REVISION_MISMATCH:${chapterPayload.resource?.textRevision ?? '<missing>'}:${state.overlay.bibleRevision}`
      )
    }
    for (const description of changedDescriptions) {
      if (!description.probe) {
        throw new Error(`BIBLE_PUBLICATION_DEPENDENT_PROBE_MISSING:${description.catalogId}`)
      }
      const route = resourceApiRoute(description.catalogId, description.probe)
      if (description.catalogId === `bible:${options.versionId}`) continue
      if (!route) continue
      const response = await fetch(`${apiBaseUrl}${route}`, {
        headers: { 'X-Firebase-AppCheck': appCheckToken },
      })
      if (!response.ok) {
        throw new Error(
          `BIBLE_PUBLICATION_SMOKE_DEPENDENT_READ_FAILED:${description.catalogId}:${response.status}`
        )
      }
      const payload = (await response.json()) as { resource?: { revision?: string } }
      if (payload.resource?.revision !== description.revision) {
        throw new Error(
          `BIBLE_PUBLICATION_SMOKE_DEPENDENT_REVISION_MISMATCH:${description.catalogId}`
        )
      }
    }
  },
})

const compensateProductionActivation = async (state: WorkflowState, originalCause: unknown) => {
  const failures: unknown[] = [originalCause]
  const catalogDestination = path.join(state.appRoot, 'src/assets/mobile-resource-catalog.json')

  if (state.neonActivated && state.overlay) {
    try {
      await runCommand(
        'yarn',
        [
          'resources:import-catalog:hosted',
          ...state.overlay.previousBundlePaths.flatMap(bundlePath => ['--root', bundlePath]),
        ],
        state.appRoot,
        neonEnvironment()
      )
      state.neonActivated = false
    } catch (cause) {
      failures.push(cause)
    }
  }

  if (state.catalogActivated || state.workerDeploymentAttempted) {
    try {
      await copyFile(state.catalogBackupPath, catalogDestination)
      if (state.workerDeploymentAttempted) {
        await runCommand(
          'yarn',
          ['resources:worker:deploy'],
          state.appRoot,
          cloudflareEnvironment()
        )
      }
      state.catalogActivated = false
      state.workerDeploymentAttempted = false
    } catch (cause) {
      failures.push(cause)
    }
  }

  if (failures.length > 1) {
    throw new Error('BIBLE_PUBLICATION_COMPENSATION_FAILED', {
      cause: new AggregateError(failures),
    })
  }
  throw new Error('BIBLE_PUBLICATION_ACTIVATION_ROLLED_BACK', { cause: originalCause })
}

export const runBiblePublicationWorkflowCli = async (rawArgs: readonly string[]) => {
  const options = parseBiblePublicationWorkflowArgs(rawArgs)
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  const databasePolicy = options.activateProduction
    ? resolveCatalogImportPolicy({
        mode: 'hosted',
        connectionString: requireEnvironment('RESOURCE_DATABASE_URL'),
      })
    : undefined
  const publicationLock = databasePolicy
    ? await acquireLocalDatabaseAdvisoryLock(
        { connectionString: databasePolicy.connectionString, maxConnections: 1 },
        PRODUCTION_PUBLICATION_LOCK_ID
      )
    : undefined
  if (databasePolicy && !publicationLock) throw new Error('BIBLE_PUBLICATION_ALREADY_RUNNING')

  try {
    const state = await createState(appRoot, options)
    let result: Awaited<ReturnType<typeof executeBiblePublicationWorkflow>>
    try {
      result = await executeBiblePublicationWorkflow(options, createOperations(state, options))
    } catch (cause) {
      if (options.activateProduction && (state.neonActivated || state.catalogActivated)) {
        await compensateProductionActivation(state, cause)
      }
      throw cause
    }
    return {
      ...result,
      workspacePath: state.workspacePath,
      catalogPath: state.catalogPath,
      changedCatalogIds: state.overlay?.changedCatalogIds ?? [],
      bibleRevision: state.overlay?.bibleRevision,
    }
  } finally {
    await publicationLock?.release()
  }
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  runBiblePublicationWorkflowCli(process.argv.slice(2))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(cause => {
      console.error(formatPublicationCliFailure(cause))
      process.exitCode = 1
    })
}
