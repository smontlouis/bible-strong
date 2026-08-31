import { createOfflineCopyId } from '~helpers/offlineCopyId'
import type { OnboardingResourceSelection } from './onboardingResources'

export const getOnboardingResourceSelectionId = (resource: OnboardingResourceSelection): string => {
  if (resource.kind === 'bible') {
    return createOfflineCopyId({ kind: 'bible', versionId: resource.versionId })
  }
  if (resource.kind === 'bible-strong') {
    return createOfflineCopyId({
      kind: 'strong-bible-index',
      versionId: resource.versionId,
    })
  }
  if (resource.kind === 'strong-lexicon') {
    return createOfflineCopyId({
      kind: 'strong-lexicon-module',
      moduleId: resource.moduleId ?? 'core',
    })
  }
  if (resource.kind === 'bible-interlinear') {
    return createOfflineCopyId({
      kind: 'interlinear-index',
      versionId: 'BHG',
      language: resource.lang,
    })
  }
  if (resource.kind === 'commentary') {
    return createOfflineCopyId({
      kind: 'commentary',
      resourceId: resource.resourceId,
      language: resource.lang,
    })
  }

  return createOfflineCopyId({
    kind: 'database',
    databaseId: resource.databaseId,
    language: resource.lang,
  })
}
