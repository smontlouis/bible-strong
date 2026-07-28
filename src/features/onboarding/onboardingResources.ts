import type { DownloadItem } from '~state/downloadQueue'
import {
  createBibleDownloadItem,
  createDatabaseDownloadItem,
  createStrongSidecarDownloadItem,
  createStrongLexiconModuleDownloadItem,
} from '~helpers/downloadItemFactory'
import { databases } from '~helpers/databases'
import { getDefaultBibleVersion, type ActiveLanguage } from '~helpers/languageUtils'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'

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
  | {
      kind: 'bible-strong'
      versionId: StrongBibleVersionId
    }
  | {
      kind: 'strong-lexicon'
    }

export const getOnboardingResourceSelectionId = (resource: OnboardingResourceSelection): string => {
  if (resource.kind === 'bible') {
    return `bible:${resource.versionId}`
  }
  if (resource.kind === 'bible-strong') {
    return `bible-strong:${resource.versionId}`
  }
  if (resource.kind === 'strong-lexicon') {
    return 'strong-lexicon:core'
  }

  return `database:${resource.databaseId}:${resource.lang}`
}

export const toggleOnboardingResourceSelection = (
  selected: OnboardingResourceSelection[],
  resource: OnboardingResourceSelection
): OnboardingResourceSelection[] => {
  const resourceId = getOnboardingResourceSelectionId(resource)
  const isSelected = selected.some(item => getOnboardingResourceSelectionId(item) === resourceId)

  if (resource.kind === 'bible-strong') {
    if (isSelected) {
      return selected.filter(item => getOnboardingResourceSelectionId(item) !== resourceId)
    }
    const baseId = `bible:${resource.versionId}`
    const withBase = selected.some(item => getOnboardingResourceSelectionId(item) === baseId)
      ? selected
      : [...selected, { kind: 'bible' as const, versionId: resource.versionId }]
    return [...withBase, resource]
  }

  if (resource.kind === 'bible') {
    if (!isSelected) return [...selected, resource]
    const strongId = `bible-strong:${resource.versionId}`
    return selected.filter(item => {
      const itemId = getOnboardingResourceSelectionId(item)
      return itemId !== resourceId && itemId !== strongId
    })
  }

  return isSelected
    ? selected.filter(item => getOnboardingResourceSelectionId(item) !== resourceId)
    : [...selected, resource]
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
  if (resource.kind === 'bible-strong') {
    return createStrongSidecarDownloadItem(resource.versionId)
  }
  if (resource.kind === 'strong-lexicon') {
    return createStrongLexiconModuleDownloadItem('core')
  }

  return createDatabaseDownloadItem(resource.databaseId, resource.lang)
}
