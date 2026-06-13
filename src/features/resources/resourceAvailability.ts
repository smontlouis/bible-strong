import * as FileSystem from 'expo-file-system/legacy'

import { isVersionInstalled } from '~helpers/biblesDb'
import { getDbPath, initLanguageDirs } from '~helpers/databases'
import { initSQLiteDir } from '~helpers/sqlite'
import { getLanguage } from '~i18n'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'

type FileInfo = {
  exists: boolean
}

export type BibleResourceRef = {
  kind: 'bible'
  versionId: string
}

export type ResourceDatabaseRef = {
  kind: 'database'
  databaseId: DatabaseId
  lang?: ResourceLanguage
}

export type LocalResourceRef = BibleResourceRef | ResourceDatabaseRef

export type LocalResourceAvailability =
  | {
      status: 'available'
      resource: LocalResourceRef
      source: 'bibles-sqlite' | 'legacy-bible-json' | 'database-file'
    }
  | {
      status: 'missing'
      resource: LocalResourceRef
      expectedPath?: string
    }

type ResourceAvailabilityDependencies = {
  getFileInfo: (path: string) => Promise<FileInfo>
  initSQLiteDir: () => Promise<unknown>
  initLanguageDirs: (lang: ResourceLanguage) => Promise<unknown>
  isVersionInstalled: (versionId: string) => Promise<boolean>
  getDbPath: (dbId: DatabaseId, lang: ResourceLanguage) => string
  getDocumentDirectory: () => string
  getCurrentResourceLanguage: () => ResourceLanguage
}

const defaultDependencies: ResourceAvailabilityDependencies = {
  getFileInfo: path => FileSystem.getInfoAsync(path),
  initSQLiteDir,
  initLanguageDirs,
  isVersionInstalled,
  getDbPath,
  getDocumentDirectory: () => FileSystem.documentDirectory ?? '',
  getCurrentResourceLanguage: () => getLanguage(),
}

export const getLocalResourceKey = (resource: LocalResourceRef): string => {
  if (resource.kind === 'bible') {
    return `bible:${resource.versionId}`
  }

  return `database:${resource.databaseId}:${resource.lang ?? 'current'}`
}

const getBibleDatabaseRef = (
  versionId: string,
  currentLang: ResourceLanguage
): ResourceDatabaseRef | null => {
  if (versionId === 'INT') {
    return { kind: 'database', databaseId: 'INTERLINEAIRE', lang: 'fr' }
  }

  if (versionId === 'INT_EN') {
    return { kind: 'database', databaseId: 'INTERLINEAIRE', lang: 'en' }
  }

  if (versionId === 'LSGS' || versionId === 'KJVS') {
    return { kind: 'database', databaseId: 'STRONG', lang: currentLang }
  }

  return null
}

export const getLocalResourceAvailability = async (
  resource: LocalResourceRef,
  dependencies: ResourceAvailabilityDependencies = defaultDependencies
): Promise<LocalResourceAvailability> => {
  if (resource.kind === 'database') {
    const lang = resource.lang ?? dependencies.getCurrentResourceLanguage()
    await dependencies.initLanguageDirs(lang)

    const expectedPath = dependencies.getDbPath(resource.databaseId, lang)
    const file = await dependencies.getFileInfo(expectedPath)

    if (file.exists) {
      return {
        status: 'available',
        resource: { ...resource, lang },
        source: 'database-file',
      }
    }

    return {
      status: 'missing',
      resource: { ...resource, lang },
      expectedPath,
    }
  }

  const currentLang = dependencies.getCurrentResourceLanguage()
  const databaseRef = getBibleDatabaseRef(resource.versionId, currentLang)

  if (databaseRef) {
    const availability = await getLocalResourceAvailability(databaseRef, dependencies)
    if (availability.status === 'available') {
      return {
        status: 'available',
        resource,
        source: 'database-file',
      }
    }

    return {
      status: 'missing',
      resource,
      expectedPath: availability.expectedPath,
    }
  }

  await dependencies.initSQLiteDir()

  const installed = await dependencies.isVersionInstalled(resource.versionId)
  if (installed) {
    return {
      status: 'available',
      resource,
      source: 'bibles-sqlite',
    }
  }

  const expectedPath = `${dependencies.getDocumentDirectory()}bible-${resource.versionId}.json`
  const legacyFile = await dependencies.getFileInfo(expectedPath)

  if (legacyFile.exists) {
    return {
      status: 'available',
      resource,
      source: 'legacy-bible-json',
    }
  }

  return {
    status: 'missing',
    resource,
    expectedPath,
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
