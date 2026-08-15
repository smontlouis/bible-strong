import type { DownloadItem } from '~state/downloadQueue'
import {
  getStrongLexiconPublication,
  type StrongLexiconModuleId,
} from './strongLexiconPublications'
import { createOfflineCopyId } from './offlineCopyId'
import { getMobileResourceCatalogEntry } from './mobileResourceCatalog'

export function createStrongLexiconModuleDownloadItem(
  moduleId: StrongLexiconModuleId
): DownloadItem {
  const publicationArtifact = getStrongLexiconPublication(moduleId)
  const id = createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId })
  const catalogArtifact = getMobileResourceCatalogEntry(id)
  const artifact = {
    ...publicationArtifact,
    url: catalogArtifact.url,
    entry: catalogArtifact.entry,
    archiveBytes: catalogArtifact.archiveBytes,
    archiveSha256: catalogArtifact.archiveSha256,
  }
  const names: Record<StrongLexiconModuleId, string> = {
    core: 'Lexique Strong',
    resources: 'Dictionnaire grec détaillé',
    entities: 'Entités bibliques',
  }
  return {
    id,
    type: 'strong-lexicon-module',
    name: names[moduleId],
    url: artifact.url,
    estimatedSize: artifact.archiveBytes,
    expectedArchiveSha256: artifact.archiveSha256,
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
