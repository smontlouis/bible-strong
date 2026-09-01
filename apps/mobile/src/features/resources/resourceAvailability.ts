import * as FileSystem from 'expo-file-system/legacy'

import { isVersionInstalled } from '~helpers/biblesDb'
import {
  getCommentaryDbPath,
  getDbPath,
  getDictionaryDbPath,
  getDictionaryDirectoryDbPath,
  initLanguageDirs,
} from '~helpers/databases'
import { dbManager, initSQLiteDir, openSQLiteDatabase } from '~helpers/sqlite'
import {
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  type DatabaseId,
  type ResourceLanguage,
} from '~helpers/databaseTypes'
import { resourceDatabaseRequiredTables } from '~helpers/resourceDatabaseSchema'
import { restoreOrphanedResourceBackup } from '~helpers/atomicResourceFile'
import {
  createOfflineCopyId,
  getOfflineCopyCatalogId,
  type OfflineCopyIdentity,
} from '~helpers/offlineCopyId'
import {
  getStrongBibleSidecarAvailability,
  type StrongBibleSidecarAvailability,
} from '~helpers/strongBibleSidecar'
import {
  getInterlinearSidecarAvailability,
  type InterlinearSidecarAvailability,
} from '~helpers/interlinearBibleSidecar'
import {
  getStrongLexiconModuleAvailability,
  type StrongLexiconModuleAvailability,
} from '~helpers/strongLexiconModules'
import {
  getMobileResourceCatalogEntry,
  MOBILE_RESOURCE_CATALOG,
  type MobileResourceCatalog,
} from '~helpers/mobileResourceCatalog'
import { resourcePublicationStore } from '~helpers/resourcePublication'
import { requirePericopePath } from '~helpers/pericopes'
import { requireRedWordsPath } from '~helpers/redWords'

const REGISTRY_DATABASE_IDS = new Set<DatabaseId>([...LANGUAGE_SPECIFIC_DBS, ...SHARED_DBS])
const RESOURCE_RECONCILIATION_CONCURRENCY = 4

type FileInfo = {
  exists: boolean
}

const getBibleChildResourcePath = (
  kind: 'bible-pericope' | 'bible-red-words',
  versionId: string
): string =>
  kind === 'bible-pericope' ? requirePericopePath(versionId) : requireRedWordsPath(versionId)

export type LocalResourceRef = OfflineCopyIdentity

export type LocalResourceAvailability =
  | {
      status: 'available'
      resource: LocalResourceRef
    }
  | {
      status: 'missing'
      resource: LocalResourceRef
      expectedPath?: string
    }
  | {
      status: 'corrupt'
      resource: LocalResourceRef
      reason: 'integrity-check-failed'
    }
  | (StrongBibleSidecarAvailability & { resource: LocalResourceRef })
  | (InterlinearSidecarAvailability & { resource: LocalResourceRef })
  | (StrongLexiconModuleAvailability & { resource: LocalResourceRef })

type ResourceAvailabilityDependencies = {
  getFileInfo: (path: string) => Promise<FileInfo>
  initSQLiteDir: () => Promise<unknown>
  initLanguageDirs: (lang: ResourceLanguage) => Promise<unknown>
  isVersionInstalled: (versionId: string) => Promise<boolean>
  getDbPath: (
    dbId: Extract<OfflineCopyIdentity, { kind: 'database' }>['databaseId'],
    lang: ResourceLanguage
  ) => string
  restoreBackup?: (path: string) => Promise<void>
  getStrongBibleAvailability?: (versionId: string) => Promise<StrongBibleSidecarAvailability>
  getInterlinearAvailability?: (
    language: ResourceLanguage
  ) => Promise<InterlinearSidecarAvailability>
  getStrongLexiconAvailability?: (
    moduleId: Extract<OfflineCopyIdentity, { kind: 'strong-lexicon-module' }>['moduleId']
  ) => Promise<StrongLexiconModuleAvailability>
  validateDatabaseResource: (
    databaseId: Exclude<DatabaseId, 'BIBLES'>,
    language: ResourceLanguage,
    path: string
  ) => Promise<boolean>
  validateStandaloneResource: (kind: 'dictionary' | 'commentary', path: string) => Promise<boolean>
}

const validateDatabaseResource = async (
  databaseId: Exclude<DatabaseId, 'BIBLES'>,
  language: ResourceLanguage,
  path: string
): Promise<boolean> => {
  try {
    if (databaseId === 'TIMELINE') {
      const decoded: unknown = JSON.parse(await FileSystem.readAsStringAsync(path))
      return decoded !== null && typeof decoded === 'object'
    }

    const managedDatabase = dbManager.getDB(databaseId, language)
    await managedDatabase.init()
    const database = managedDatabase.get()
    if (!database) return false
    const integrity = await database.getFirstAsync<Record<string, string>>('PRAGMA quick_check')
    if (!integrity || !Object.values(integrity).includes('ok')) return false
    for (const requiredTable of resourceDatabaseRequiredTables[databaseId] ?? []) {
      const table = await database.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND lower(name) = lower(?)`,
        [requiredTable]
      )
      if (!table) return false
    }
    return true
  } catch {
    return false
  }
}

const validateStandaloneResource = async (
  kind: 'dictionary' | 'commentary',
  path: string
): Promise<boolean> => {
  const fileName = path.split('/').pop()!
  const directory = path.slice(0, -(fileName.length + 1))
  let database: Awaited<ReturnType<typeof openSQLiteDatabase>> | undefined
  try {
    database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
    const integrity = await database.getFirstAsync<Record<string, string>>('PRAGMA quick_check')
    if (!integrity || !Object.values(integrity).includes('ok')) return false
    const tables = await database.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_schema WHERE type = 'table'`
    )
    const tableNames = new Set(tables.map(table => table.name.toLowerCase()))
    return kind === 'dictionary'
      ? tableNames.has('dictionnaire')
      : tableNames.has('commentaires') ||
          (tableNames.has('commentary_documents') && tableNames.has('commentary_verse_documents'))
  } catch {
    return false
  } finally {
    await database?.closeAsync()
  }
}

const defaultDependencies: ResourceAvailabilityDependencies = {
  getFileInfo: path => FileSystem.getInfoAsync(path),
  initSQLiteDir,
  initLanguageDirs,
  isVersionInstalled,
  getDbPath,
  restoreBackup: path => restoreOrphanedResourceBackup(path, `${path}.backup`),
  getStrongBibleAvailability: getStrongBibleSidecarAvailability,
  getInterlinearAvailability: getInterlinearSidecarAvailability,
  getStrongLexiconAvailability: getStrongLexiconModuleAvailability,
  validateDatabaseResource,
  validateStandaloneResource,
}

export const getLocalResourceKey = (resource: LocalResourceRef): string =>
  createOfflineCopyId(resource)

export const probeLocalResourceAvailability = async (
  resource: LocalResourceRef,
  dependencies: ResourceAvailabilityDependencies = defaultDependencies
): Promise<LocalResourceAvailability> => {
  if (resource.kind === 'bible-pericope' || resource.kind === 'bible-red-words') {
    const expectedPath = getBibleChildResourcePath(resource.kind, resource.versionId)
    await dependencies.restoreBackup?.(expectedPath)
    const file = await dependencies.getFileInfo(expectedPath)
    return file.exists
      ? { status: 'available', resource }
      : { status: 'missing', resource, expectedPath }
  }

  if (resource.kind === 'strong-bible-index') {
    const availability = await (
      dependencies.getStrongBibleAvailability ?? getStrongBibleSidecarAvailability
    )(resource.versionId)
    return { ...availability, resource }
  }

  if (resource.kind === 'interlinear-index') {
    const availability = await (
      dependencies.getInterlinearAvailability ?? getInterlinearSidecarAvailability
    )(resource.language)
    return { ...availability, resource }
  }

  if (resource.kind === 'strong-lexicon-module') {
    const availability = await (
      dependencies.getStrongLexiconAvailability ?? getStrongLexiconModuleAvailability
    )(resource.moduleId)
    return { ...availability, resource }
  }

  if (resource.kind === 'database') {
    const lang = resource.language
    await dependencies.initLanguageDirs(lang)

    const expectedPath = dependencies.getDbPath(resource.databaseId, lang)
    await dependencies.restoreBackup?.(expectedPath)
    const file = await dependencies.getFileInfo(expectedPath)

    if (file.exists) {
      if (!(await dependencies.validateDatabaseResource(resource.databaseId, lang, expectedPath))) {
        return { status: 'corrupt', resource, reason: 'integrity-check-failed' }
      }
      return {
        status: 'available',
        resource,
      }
    }

    return {
      status: 'missing',
      resource,
      expectedPath,
    }
  }

  if (resource.kind === 'dictionary') {
    const expectedPath = getDictionaryDbPath(resource.work, resource.language)
    await dependencies.restoreBackup?.(expectedPath)
    const file = await dependencies.getFileInfo(expectedPath)
    if (!file.exists) return { status: 'missing', resource, expectedPath }
    return (await dependencies.validateStandaloneResource('dictionary', expectedPath))
      ? { status: 'available', resource }
      : { status: 'corrupt', resource, reason: 'integrity-check-failed' }
  }

  if (resource.kind === 'dictionary-directory') {
    const expectedPath = getDictionaryDirectoryDbPath()
    await dependencies.restoreBackup?.(expectedPath)
    const file = await dependencies.getFileInfo(expectedPath)
    if (!file.exists) return { status: 'missing', resource, expectedPath }
    const fileName = expectedPath.split('/').pop()!
    const directory = expectedPath.slice(0, -(fileName.length + 1))
    try {
      const database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
      try {
        const integrity = await database.getFirstAsync<{ integrity_check: string }>(
          'PRAGMA quick_check'
        )
        const tables = await database.getAllAsync<{ name: string }>(
          `SELECT name FROM sqlite_schema WHERE type = 'table'`
        )
        const tableNames = new Set(tables.map(table => table.name.toLowerCase()))
        const valid =
          integrity?.integrity_check === 'ok' &&
          [
            'dictionary_works',
            'dictionary_entries',
            'dictionary_correspondences',
            'dictionary_correspondence_members',
            'dictionary_passage_anchors',
          ].every(table => tableNames.has(table))
        return valid
          ? { status: 'available', resource }
          : { status: 'corrupt', resource, reason: 'integrity-check-failed' }
      } finally {
        await database.closeAsync()
      }
    } catch {
      return { status: 'corrupt', resource, reason: 'integrity-check-failed' }
    }
  }

  if (resource.kind === 'commentary') {
    const expectedPath = getCommentaryDbPath(resource.resourceId, resource.language)
    await dependencies.restoreBackup?.(expectedPath)
    const file = await dependencies.getFileInfo(expectedPath)
    if (!file.exists) return { status: 'missing', resource, expectedPath }
    return (await dependencies.validateStandaloneResource('commentary', expectedPath))
      ? { status: 'available', resource }
      : { status: 'corrupt', resource, reason: 'integrity-check-failed' }
  }

  await dependencies.initSQLiteDir()

  const installed = await dependencies.isVersionInstalled(resource.versionId)
  if (installed) {
    const archiveEntries = getMobileResourceCatalogEntry(createOfflineCopyId(resource)).entries
    const requiredChildKinds = [
      ...(archiveEntries.pericope ? (['bible-pericope'] as const) : []),
      ...(archiveEntries.redWords ? (['bible-red-words'] as const) : []),
    ]
    for (const kind of requiredChildKinds) {
      const expectedPath = getBibleChildResourcePath(kind, resource.versionId)
      await dependencies.restoreBackup?.(expectedPath)
      if (!(await dependencies.getFileInfo(expectedPath)).exists) {
        return { status: 'missing', resource, expectedPath }
      }
    }

    return {
      status: 'available',
      resource,
    }
  }

  return {
    status: 'missing',
    resource,
  }
}

export type OfflineResourceRegistryEntry = {
  id: string
  resource: LocalResourceRef
  availability: LocalResourceAvailability
  verified: boolean
  installedRevision?: string
  catalogRevision?: string
  updateAvailable: boolean
}

export type OfflineResourceRegistrySnapshot = {
  revision: number
  phase: 'idle' | 'reconciling' | 'ready'
  resources: ReadonlyMap<string, OfflineResourceRegistryEntry>
}

const getCatalogResourceRefs = (catalog: MobileResourceCatalog): LocalResourceRef[] => {
  const refs: LocalResourceRef[] = []
  for (const [resourceId, catalogEntry] of Object.entries(catalog.resources)) {
    const resource = parseRegistryResourceId(resourceId, catalogEntry)
    if (!resource) continue

    refs.push(resource)
    if (resource.kind !== 'bible') continue
    const entries = catalog.resources[resourceId]?.entries
    if (entries?.pericope) {
      refs.push({ kind: 'bible-pericope', versionId: resource.versionId })
    }
    if (entries?.redWords) {
      refs.push({ kind: 'bible-red-words', versionId: resource.versionId })
    }
  }

  return [...new Map(refs.map(resource => [createOfflineCopyId(resource), resource])).values()]
}

const parseRegistryResourceId = (
  id: string,
  catalogEntry?: MobileResourceCatalog['resources'][string]
): LocalResourceRef | undefined => {
  if (id === 'dictionary-directory') return { kind: 'dictionary-directory' }
  const parts = id.split(':')
  const language = parts.at(-1) as ResourceLanguage
  if (parts[0] === 'bible' && parts[1]) return { kind: 'bible', versionId: parts[1] }
  if (parts[0] === 'bible-strong' && parts[1]) {
    return { kind: 'strong-bible-index', versionId: parts[1] as never }
  }
  if (parts[0] === 'bible-interlinear' && parts[1] === 'BHG' && parts.length === 3) {
    return { kind: 'interlinear-index', versionId: 'BHG', language }
  }
  if (parts[0] === 'strong-lexicon' && parts[1]) {
    return { kind: 'strong-lexicon-module', moduleId: parts[1] as never }
  }
  if (parts[0] === 'dictionary' && parts.length === 4) {
    return { kind: 'dictionary', work: parts[1], resourceId: parts[2], language }
  }
  if (parts[0] === 'database' && parts[1] && parts.length === 3) {
    const dictionaryWork =
      catalogEntry?.resourceRevision?.match(/^dictionary-(.+)-(?:fr|en)-[a-f0-9]+$/u)?.[1] ??
      catalogEntry?.file.match(/^dictionaries\/dictionary-(.+)-(?:fr|en)\.sqlite\.zip$/u)?.[1]
    if (dictionaryWork && catalogEntry?.file.startsWith('dictionaries/')) {
      return {
        kind: 'dictionary',
        work: dictionaryWork,
        resourceId: parts[1],
        language,
      }
    }
    return REGISTRY_DATABASE_IDS.has(parts[1] as DatabaseId)
      ? {
          kind: 'database',
          databaseId: parts[1] as Exclude<DatabaseId, 'BIBLES'>,
          language,
        }
      : { kind: 'commentary', resourceId: parts[1], language }
  }
  if (parts[0] === 'bible-pericope' && parts[1]) {
    return { kind: 'bible-pericope', versionId: parts[1] }
  }
  if (parts[0] === 'bible-red-words' && parts[1]) {
    return { kind: 'bible-red-words', versionId: parts[1] }
  }
  return undefined
}

export type OfflineResourceRegistryDependencies = {
  probe: (resource: LocalResourceRef) => Promise<LocalResourceAvailability>
  readPublication: typeof resourcePublicationStore.read
  getCatalog: () => MobileResourceCatalog
}

const defaultRegistryDependencies: OfflineResourceRegistryDependencies = {
  probe: resource => probeLocalResourceAvailability(resource),
  readPublication: resourceId => resourcePublicationStore.read(resourceId),
  getCatalog: () => MOBILE_RESOURCE_CATALOG,
}

export class OfflineResourceRegistry {
  private listeners = new Set<() => void>()
  private entries = new Map<string, OfflineResourceRegistryEntry>()
  private snapshot: OfflineResourceRegistrySnapshot = {
    revision: 0,
    phase: 'idle',
    resources: this.entries,
  }
  private reconciliationTasks = new Map<string, Promise<LocalResourceAvailability>>()
  private allReconciliationTask?: Promise<void>

  constructor(
    private readonly dependencies: OfflineResourceRegistryDependencies = defaultRegistryDependencies
  ) {
    this.syncCatalog(this.dependencies.getCatalog(), false)
  }

  getSnapshot = (): OfflineResourceRegistrySnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get(resource: LocalResourceRef | string): OfflineResourceRegistryEntry | undefined {
    const id = typeof resource === 'string' ? resource : createOfflineCopyId(resource)
    return this.entries.get(id)
  }

  isInstalled(resource: LocalResourceRef | string): boolean {
    const entry = this.get(resource)
    return entry?.availability.status === 'available' || entry?.availability.status === 'corrupt'
  }

  syncCatalog(catalog: MobileResourceCatalog = MOBILE_RESOURCE_CATALOG, emit = true): void {
    if (!catalog?.resources) return
    let changed = false
    const catalogResources = getCatalogResourceRefs(catalog)
    const catalogResourceIds = new Set(catalogResources.map(createOfflineCopyId))
    for (const id of this.entries.keys()) {
      if (catalogResourceIds.has(id)) continue
      this.entries.delete(id)
      changed = true
    }
    for (const resource of catalogResources) {
      const id = createOfflineCopyId(resource)
      const catalogRevision = catalog.resources[getOfflineCopyCatalogId(resource)]?.archiveSha256
      const installed = this.dependencies.readPublication(id)
      const previous = this.entries.get(id)
      const availability: LocalResourceAvailability =
        previous?.verified === true
          ? previous.availability
          : installed
            ? { status: 'available', resource }
            : (previous?.availability ?? { status: 'missing', resource })
      const next: OfflineResourceRegistryEntry = {
        id,
        resource,
        availability,
        verified: previous?.verified ?? false,
        installedRevision: installed?.archiveSha256,
        catalogRevision,
        updateAvailable: Boolean(
          installed && catalogRevision && installed.archiveSha256 !== catalogRevision
        ),
      }
      if (
        !previous ||
        previous.catalogRevision !== next.catalogRevision ||
        previous.installedRevision !== next.installedRevision ||
        previous.updateAvailable !== next.updateAvailable ||
        previous.availability.status !== next.availability.status
      ) {
        this.entries.set(id, next)
        changed = true
      }
    }
    if (changed && emit) this.emit()
  }

  async getAvailability(resource: LocalResourceRef): Promise<LocalResourceAvailability> {
    const entry = this.get(resource)
    if (entry?.verified) return entry.availability
    return this.reconcile(resource)
  }

  reconcile(resource: LocalResourceRef): Promise<LocalResourceAvailability> {
    const id = createOfflineCopyId(resource)
    const currentTask = this.reconciliationTasks.get(id)
    if (currentTask) return currentTask

    const task = this.dependencies
      .probe(resource)
      .then(availability => {
        this.setAvailability(resource, availability, true)
        return availability
      })
      .catch(() => {
        const availability: LocalResourceAvailability = {
          status: 'corrupt',
          resource,
          reason: 'integrity-check-failed',
        }
        this.setAvailability(resource, availability, true)
        return availability
      })
      .finally(() => this.reconciliationTasks.delete(id))
    this.reconciliationTasks.set(id, task)
    return task
  }

  reconcileAll(catalog: MobileResourceCatalog = this.dependencies.getCatalog()): Promise<void> {
    if (this.allReconciliationTask) return this.allReconciliationTask
    this.syncCatalog(catalog)
    this.setPhase('reconciling')
    const resources = getCatalogResourceRefs(catalog)
    let cursor = 0
    const reconcileNext = async (): Promise<void> => {
      while (cursor < resources.length) {
        const resource = resources[cursor++]
        await this.reconcile(resource).catch(() => undefined)
      }
    }
    const task = Promise.all(
      Array.from(
        { length: Math.min(RESOURCE_RECONCILIATION_CONCURRENCY, resources.length) },
        reconcileNext
      )
    )
      .then(() => this.setPhase('ready'))
      .finally(() => {
        this.allReconciliationTask = undefined
      })
    this.allReconciliationTask = task
    return task
  }

  markInstalled(resource: LocalResourceRef | string): void {
    const resolved = typeof resource === 'string' ? parseRegistryResourceId(resource) : resource
    if (!resolved) return
    // Installation is visible synchronously. The first content access then performs
    // the single specialised reconciliation needed to hydrate sidecar metadata.
    this.setAvailability(resolved, { status: 'available', resource: resolved }, false)
  }

  markMissing(resource: LocalResourceRef | string): void {
    const resolved = typeof resource === 'string' ? parseRegistryResourceId(resource) : resource
    if (!resolved) return
    this.setAvailability(resolved, { status: 'missing', resource: resolved }, true)
  }

  markCorrupt(resource: LocalResourceRef | string): void {
    const resolved = typeof resource === 'string' ? parseRegistryResourceId(resource) : resource
    if (!resolved) return
    this.setAvailability(
      resolved,
      { status: 'corrupt', resource: resolved, reason: 'integrity-check-failed' },
      true
    )
  }

  invalidate(resource: LocalResourceRef | string): void {
    const resolved = typeof resource === 'string' ? parseRegistryResourceId(resource) : resource
    if (!resolved) return
    const id = createOfflineCopyId(resolved)
    const previous = this.entries.get(id)
    if (!previous) return
    this.entries.set(id, { ...previous, verified: false })
    this.emit()
  }

  private setAvailability(
    resource: LocalResourceRef,
    availability: LocalResourceAvailability,
    verified: boolean
  ): void {
    const id = createOfflineCopyId(resource)
    const installed = this.dependencies.readPublication(id)
    const catalogRevision =
      this.dependencies.getCatalog().resources[getOfflineCopyCatalogId(resource)]?.archiveSha256
    this.entries.set(id, {
      id,
      resource,
      availability,
      verified,
      installedRevision: installed?.archiveSha256,
      catalogRevision,
      updateAvailable: Boolean(
        installed && catalogRevision && installed.archiveSha256 !== catalogRevision
      ),
    })
    this.emit()
  }

  private setPhase(phase: OfflineResourceRegistrySnapshot['phase']): void {
    if (this.snapshot.phase === phase) return
    this.snapshot = { ...this.snapshot, phase }
    this.emit(false)
  }

  private emit(refreshSnapshot = true): void {
    if (refreshSnapshot) {
      this.snapshot = {
        revision: this.snapshot.revision + 1,
        phase: this.snapshot.phase,
        resources: new Map(this.entries),
      }
    } else {
      this.snapshot = { ...this.snapshot, revision: this.snapshot.revision + 1 }
    }
    this.listeners.forEach(listener => listener())
  }
}

export const offlineResourceRegistry = new OfflineResourceRegistry()

export const getRegisteredStrongBibleAvailability = async (
  versionId: string
): Promise<StrongBibleSidecarAvailability> =>
  offlineResourceRegistry.getAvailability({
    kind: 'strong-bible-index',
    versionId: versionId as never,
  }) as Promise<StrongBibleSidecarAvailability>

export const getRegisteredInterlinearAvailability = async (
  language: ResourceLanguage
): Promise<InterlinearSidecarAvailability> =>
  offlineResourceRegistry.getAvailability({
    kind: 'interlinear-index',
    versionId: 'BHG',
    language,
  }) as Promise<InterlinearSidecarAvailability>

export const getRegisteredStrongLexiconAvailability = async (
  moduleId: Extract<OfflineCopyIdentity, { kind: 'strong-lexicon-module' }>['moduleId']
): Promise<StrongLexiconModuleAvailability> =>
  offlineResourceRegistry.getAvailability({
    kind: 'strong-lexicon-module',
    moduleId,
  }) as Promise<StrongLexiconModuleAvailability>

export const getLocalResourceAvailability = async (
  resource: LocalResourceRef,
  dependencies?: ResourceAvailabilityDependencies
): Promise<LocalResourceAvailability> =>
  dependencies
    ? probeLocalResourceAvailability(resource, dependencies)
    : offlineResourceRegistry.getAvailability(resource)

export const isLocalResourceAvailable = async (
  resource: LocalResourceRef,
  dependencies?: ResourceAvailabilityDependencies
): Promise<boolean> => {
  const availability = await getLocalResourceAvailability(resource, dependencies)
  return availability.status === 'available'
}

export const getIfLocalResourceNeedsDownload = async (
  resource: LocalResourceRef,
  dependencies?: ResourceAvailabilityDependencies
): Promise<boolean> => {
  const available = await isLocalResourceAvailable(resource, dependencies)
  return !available
}
