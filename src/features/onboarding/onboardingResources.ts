import type { DownloadItem } from '~state/downloadQueue'
import { createBibleDownloadItem, createDatabaseDownloadItem } from '~helpers/downloadItemFactory'
import { getDefaultBibleVersion, type ActiveLanguage } from '~helpers/languageUtils'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'

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

export const createDownloadItemFromOnboardingSelection = (
  resource: OnboardingResourceSelection
): DownloadItem => {
  if (resource.kind === 'bible') {
    return createBibleDownloadItem(resource.versionId)
  }

  return createDatabaseDownloadItem(resource.databaseId, resource.lang)
}
