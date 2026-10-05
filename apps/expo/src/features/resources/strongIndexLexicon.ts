import { getSimpleStrongModuleId } from '@bible-strong/resource-domain/strong-lexicon'

import type { ResourceLanguage } from '~helpers/databaseTypes'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import type { OfflineResourceRegistrySnapshot } from './resourceAvailability'

/**
 * The Strong lexicon to acquire with a Strong Bible index: the simple lexicon in the reader's
 * Strong language, unless a lexicon able to open a Strong entry is already installed.
 */
export const getStrongIndexLexiconModuleId = (
  registry: OfflineResourceRegistrySnapshot,
  language: ResourceLanguage
): StrongLexiconModuleId | undefined => {
  const isInstalled = (moduleId: StrongLexiconModuleId) =>
    registry.resources.get(createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId }))
      ?.availability.status === 'available'
  const simpleModuleId = getSimpleStrongModuleId(language)
  return isInstalled(simpleModuleId) || isInstalled('core') ? undefined : simpleModuleId
}
