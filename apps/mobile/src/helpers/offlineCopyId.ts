import type { DatabaseId, ResourceLanguage } from './databaseTypes'
import type { StrongBibleVersionId } from './strongBiblePublications'
import type { StrongLexiconModuleId } from './strongLexiconPublications'

export type OfflineCopyIdentity =
  | { kind: 'bible'; versionId: string }
  | { kind: 'strong-bible-index'; versionId: StrongBibleVersionId }
  | { kind: 'interlinear-index'; versionId: 'BHG'; language: ResourceLanguage }
  | { kind: 'strong-lexicon-module'; moduleId: StrongLexiconModuleId }
  | {
      kind: 'dictionary'
      work: string
      resourceId: string
      language: ResourceLanguage
    }
  | { kind: 'dictionary-directory' }
  | { kind: 'commentary'; resourceId: string; language: ResourceLanguage }
  | { kind: 'database'; databaseId: Exclude<DatabaseId, 'BIBLES'>; language: ResourceLanguage }
  | { kind: 'bible-pericope'; versionId: string }
  | { kind: 'bible-red-words'; versionId: string }

export type OfflineCopyId = string

export const createOfflineCopyId = (identity: OfflineCopyIdentity): OfflineCopyId => {
  switch (identity.kind) {
    case 'bible':
      return `bible:${identity.versionId}`
    case 'strong-bible-index':
      return `bible-strong:${identity.versionId}`
    case 'interlinear-index':
      return `bible-interlinear:${identity.versionId}:${identity.language}`
    case 'strong-lexicon-module':
      return `strong-lexicon:${identity.moduleId}`
    case 'dictionary':
      return `dictionary:${identity.work}:${identity.resourceId}:${identity.language}`
    case 'dictionary-directory':
      return 'dictionary-directory'
    case 'commentary':
      return `database:${identity.resourceId}:${identity.language}`
    case 'database':
      return `database:${identity.databaseId}:${identity.language}`
    case 'bible-pericope':
      return `bible-pericope:${identity.versionId}`
    case 'bible-red-words':
      return `bible-red-words:${identity.versionId}`
  }
}
