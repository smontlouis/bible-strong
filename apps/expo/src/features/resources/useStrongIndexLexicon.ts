import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import { useResourceLanguage } from '~state/resourcesLanguage'
import { getStrongIndexLexiconModuleId } from './strongIndexLexicon'
import { useOfflineResourceRegistry } from './useOfflineResourceRegistry'

export const useStrongIndexLexiconModuleId = (): StrongLexiconModuleId | undefined => {
  const registry = useOfflineResourceRegistry()
  const [language] = useResourceLanguage('STRONG')
  return getStrongIndexLexiconModuleId(registry, language)
}
