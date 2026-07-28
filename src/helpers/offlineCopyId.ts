import type { DatabaseId, ResourceLanguage } from './databaseTypes'
import type { StrongBibleVersionId } from './strongBiblePublications'
import type { StrongLexiconModuleId } from './strongLexiconPublications'

export type OfflineCopyIdentity =
  | { kind: 'bible'; versionId: string }
  | { kind: 'strong-bible-index'; versionId: StrongBibleVersionId }
  | { kind: 'interlinear-index'; versionId: 'BHG'; language: ResourceLanguage }
  | { kind: 'strong-lexicon-module'; moduleId: StrongLexiconModuleId }
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
    case 'database':
      return `database:${identity.databaseId}:${identity.language}`
    case 'bible-pericope':
      return `bible-pericope:${identity.versionId}`
    case 'bible-red-words':
      return `bible-red-words:${identity.versionId}`
  }
}
