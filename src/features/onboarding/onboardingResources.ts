import type { DownloadItem } from '~state/downloadQueue'
import {
  createBibleDownloadItem,
  createDatabaseDownloadItem,
  createInterlinearSidecarDownloadItem,
  createStrongSidecarDownloadItem,
  createStrongLexiconModuleDownloadItem,
} from '~helpers/downloadItemFactory'
import { databases } from '~helpers/databases'
import { getDefaultBibleVersion, type ActiveLanguage } from '~helpers/languageUtils'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import { createOfflineCopyId, type OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { getOnboardingResourceSelectionId } from './onboardingResourceSelectionId'

export { getOnboardingResourceSelectionId } from './onboardingResourceSelectionId'

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
      databaseId: Exclude<DatabaseId, 'BIBLES'>
      lang: ResourceLanguage
    }
  | {
      kind: 'bible-strong'
      versionId: StrongBibleVersionId
    }
  | {
      kind: 'strong-lexicon'
      moduleId?: StrongLexiconModuleId
    }
  | {
      kind: 'bible-interlinear'
      lang: ResourceLanguage
    }

export const getOnboardingResourceIdentity = (
  resource: OnboardingResourceSelection
): OfflineCopyIdentity => {
  if (resource.kind === 'bible') return { kind: 'bible', versionId: resource.versionId }
  if (resource.kind === 'bible-strong') {
    return { kind: 'strong-bible-index', versionId: resource.versionId }
  }
  if (resource.kind === 'strong-lexicon') {
    return { kind: 'strong-lexicon-module', moduleId: resource.moduleId ?? 'core' }
  }
  if (resource.kind === 'bible-interlinear') {
    return { kind: 'interlinear-index', versionId: 'BHG', language: resource.lang }
  }
  return { kind: 'database', databaseId: resource.databaseId, language: resource.lang }
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
    const baseId = createOfflineCopyId({ kind: 'bible', versionId: resource.versionId })
    const withBase = selected.some(item => getOnboardingResourceSelectionId(item) === baseId)
      ? selected
      : [...selected, { kind: 'bible' as const, versionId: resource.versionId }]
    return [...withBase, resource]
  }

  if (resource.kind === 'bible') {
    if (!isSelected) return [...selected, resource]
    return selected.filter(item => {
      const itemId = getOnboardingResourceSelectionId(item)
      return !(
        itemId === resourceId ||
        (item.kind === 'bible-strong' && item.versionId === resource.versionId)
      )
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
  Object.values(databases(lang)).filter(db => lang === 'fr' || db.id !== 'MHY')

export const createDownloadItemFromOnboardingSelection = (
  resource: OnboardingResourceSelection
): DownloadItem => {
  if (resource.kind === 'bible') {
    return createBibleDownloadItem(resource.versionId)
  }
  if (resource.kind === 'bible-strong') {
    return {
      ...createStrongSidecarDownloadItem(resource.versionId),
      dependsOnId: createOfflineCopyId({ kind: 'bible', versionId: resource.versionId }),
    }
  }
  if (resource.kind === 'strong-lexicon') {
    const moduleId = resource.moduleId ?? 'core'
    const item = createStrongLexiconModuleDownloadItem(moduleId)
    return moduleId === 'core'
      ? item
      : {
          ...item,
          dependsOnId: createOfflineCopyId({
            kind: 'strong-lexicon-module',
            moduleId: 'core',
          }),
        }
  }
  if (resource.kind === 'bible-interlinear') {
    return {
      ...createInterlinearSidecarDownloadItem(resource.lang),
      dependsOnId: createOfflineCopyId({ kind: 'bible', versionId: 'BHG' }),
    }
  }

  return createDatabaseDownloadItem(resource.databaseId, resource.lang)
}
