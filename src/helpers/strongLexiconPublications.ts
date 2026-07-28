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
    archiveBytes: 6_525_271,
    schemaVersion: 1,
  },
  resources: {
    id: 'resources',
    required: false,
    url: cdnUrl('databases/strong_lexicon.resources.sqlite.zip'),
    entry: 'strong_lexicon.resources.sqlite',
    archiveBytes: 11_568_894,
    schemaVersion: 1,
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
