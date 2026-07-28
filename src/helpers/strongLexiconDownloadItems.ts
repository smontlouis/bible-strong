import type { DownloadItem } from '~state/downloadQueue'
import {
  getStrongLexiconPublication,
  type StrongLexiconModuleId,
} from './strongLexiconPublications'

export function createStrongLexiconModuleDownloadItem(
  moduleId: StrongLexiconModuleId
): DownloadItem {
  const artifact = getStrongLexiconPublication(moduleId)
  const names: Record<StrongLexiconModuleId, string> = {
    core: 'Lexique Strong',
    resources: 'Dictionnaire grec détaillé',
    entities: 'Entités bibliques',
  }
  return {
    id: `strong-lexicon:${moduleId}`,
    type: 'strong-lexicon-module',
    name: names[moduleId],
    url: artifact.url,
    estimatedSize: artifact.archiveBytes,
    strongLexiconModuleId: moduleId,
    strongLexiconArtifact: artifact,
    addedAt: Date.now(),
    retryCount: 0,
  }
}

export const createStrongLexiconModuleDownloadPlan = (
  moduleId: StrongLexiconModuleId,
  isCoreAvailable: boolean
): DownloadItem[] => {
  const moduleItem = createStrongLexiconModuleDownloadItem(moduleId)
  if (moduleId === 'core' || isCoreAvailable) return [moduleItem]
  const core = createStrongLexiconModuleDownloadItem('core')
  return [core, { ...moduleItem, dependsOnId: core.id }]
}
