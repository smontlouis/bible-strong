import { cdnUrl } from './firebase'

export type StrongLexiconModuleId = 'core' | 'resources' | 'entities'

export type StrongLexiconPublicationArtifact = {
  id: StrongLexiconModuleId
  required: boolean
  url: string
  entry: string
  archiveBytes: number
  schemaVersion: number
}

export const STRONG_LEXICON_PUBLICATIONS: Record<
  StrongLexiconModuleId,
  StrongLexiconPublicationArtifact
> = {
  core: {
    id: 'core',
    required: true,
    url: cdnUrl('databases/strong_lexicon.core.sqlite.zip'),
    entry: 'strong_lexicon.core.sqlite',
    archiveBytes: 5_621_474,
    schemaVersion: 2,
  },
  resources: {
    id: 'resources',
    required: false,
    url: cdnUrl('databases/strong_lexicon.resources.sqlite.zip'),
    entry: 'strong_lexicon.resources.sqlite',
    archiveBytes: 13_438_540,
    schemaVersion: 2,
  },
  entities: {
    id: 'entities',
    required: false,
    url: cdnUrl('databases/bible_entities.sqlite.zip'),
    entry: 'bible_entities.production.sqlite',
    archiveBytes: 5_315_076,
    schemaVersion: 1,
  },
}

export const getStrongLexiconPublication = (
  moduleId: StrongLexiconModuleId
): StrongLexiconPublicationArtifact => STRONG_LEXICON_PUBLICATIONS[moduleId]
