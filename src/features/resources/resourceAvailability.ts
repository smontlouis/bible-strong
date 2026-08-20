import * as FileSystem from 'expo-file-system/legacy'

import { isVersionInstalled } from '~helpers/biblesDb'
import { getDbPath, initLanguageDirs } from '~helpers/databases'
import { dbManager, initSQLiteDir } from '~helpers/sqlite'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'
import { resourceDatabaseRequiredTables } from '~helpers/resourceDatabaseSchema'
import { restoreOrphanedResourceBackup } from '~helpers/atomicResourceFile'
import { createOfflineCopyId, type OfflineCopyIdentity } from '~helpers/offlineCopyId'
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
import { getMobileResourceCatalogEntry } from '~helpers/mobileResourceCatalog'
import { requirePericopePath } from '~helpers/pericopes'
import { requireRedWordsPath } from '~helpers/redWords'

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
  | (Exclude<StrongBibleSidecarAvailability, { status: 'available' | 'missing' }> & {
      resource: LocalResourceRef
    })
  | (Exclude<InterlinearSidecarAvailability, { status: 'available' | 'missing' }> & {
      resource: LocalResourceRef
    })
  | (Exclude<StrongLexiconModuleAvailability, { status: 'available' | 'missing' }> & {
      resource: LocalResourceRef
    })

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
}

export const getLocalResourceKey = (resource: LocalResourceRef): string =>
  createOfflineCopyId(resource)

export const getLocalResourceAvailability = async (
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
    return availability.status === 'available'
      ? { status: 'available', resource }
      : { ...availability, resource }
  }

  if (resource.kind === 'interlinear-index') {
    const availability = await (
      dependencies.getInterlinearAvailability ?? getInterlinearSidecarAvailability
    )(resource.language)
    return availability.status === 'available'
      ? { status: 'available', resource }
      : { ...availability, resource }
  }

  if (resource.kind === 'strong-lexicon-module') {
    const availability = await (
      dependencies.getStrongLexiconAvailability ?? getStrongLexiconModuleAvailability
    )(resource.moduleId)
    return availability.status === 'available'
      ? { status: 'available', resource }
      : { ...availability, resource }
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
