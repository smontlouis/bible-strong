import type { DownloadItem } from '~state/downloadQueue'
import { createBibleDownloadItem, createDatabaseDownloadItem } from '~helpers/downloadItemFactory'
import { databases } from '~helpers/databases'
import { getDefaultBibleVersion, type ActiveLanguage } from '~helpers/languageUtils'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'

type DownloadableDatabaseResources = ReturnType<typeof databases>
export type OnboardingDatabaseResourceOption =
  DownloadableDatabaseResources[keyof DownloadableDatabaseResources]

export type OnboardingResourceSelection =
  | {
      kind: 'bible'
      versionId: string
    }
  | {
      kind: 'database'
      databaseId: DatabaseId
      lang: ResourceLanguage
    }

export const getOnboardingResourceSelectionId = (resource: OnboardingResourceSelection): string => {
  if (resource.kind === 'bible') {
    return `bible:${resource.versionId}`
  }

  return `database:${resource.databaseId}:${resource.lang}`
}

export const getDefaultOnboardingResourceSelection = (
  lang: ActiveLanguage
): OnboardingResourceSelection => ({
  kind: 'bible',
  versionId: getDefaultBibleVersion(lang),
})

export const getOnboardingDatabaseResourceOptions = (
  lang: ResourceLanguage
): OnboardingDatabaseResourceOption[] =>
  Object.values(databases(lang)).filter(db => (lang !== 'fr' ? db.id !== 'MHY' : true))

export const createDownloadItemFromOnboardingSelection = (
  resource: OnboardingResourceSelection
): DownloadItem => {
  if (resource.kind === 'bible') {
    return createBibleDownloadItem(resource.versionId)
  }

  return createDatabaseDownloadItem(resource.databaseId, resource.lang)
}
