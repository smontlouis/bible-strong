import { resourceArtifactUrl } from './mobileResourceCatalog'

export type StrongLexiconModuleId = 'core' | 'resources' | 'entities'

export type StrongLexiconPublicationArtifact = {
  id: StrongLexiconModuleId
  required: boolean
  url: string
  entry: string
  archiveBytes: number
  archiveSha256: string
  contentBytes: number
  contentSha256: string
  resourceRevision: string
  coreRevision?: string
}

export const STRONG_LEXICON_PUBLICATIONS: Record<
  StrongLexiconModuleId,
  StrongLexiconPublicationArtifact
> = {
  core: {
    id: 'core',
    required: true,
    url: resourceArtifactUrl('databases/strong_lexicon.core.sqlite.zip'),
    entry: 'strong_lexicon.core.sqlite',
    archiveBytes: 6_543_526,
    archiveSha256: '063629b535055ecc5938f44a40fa442fd333652ed2440459e7c91784340baa5d',
    contentBytes: 30_371_840,
    contentSha256: '4697c3a496a7e647922114771a0332530a21c86752fb67d1d98cf7bfd00fd3e1',
    resourceRevision: 'strong-lexicon-core-4392debcb0c9fb65d2ca9699',
  },
  resources: {
    id: 'resources',
    required: false,
    url: resourceArtifactUrl('databases/strong_lexicon.resources.sqlite.zip'),
    entry: 'strong_lexicon.resources.sqlite',
    archiveBytes: 11_492_177,
    archiveSha256: '956950545e6a1014b8b05b020c84a8accf21eb958e670964976d0dc52c34888e',
    contentBytes: 52_072_448,
    contentSha256: '84c2d3b684242b54473093fc21f9d4dc549b0d359461dc9eade12831f62d0826',
    resourceRevision: 'strong-lexicon-resources-c8cb209a32d429e67fb5f06b',
    coreRevision: 'strong-lexicon-core-4392debcb0c9fb65d2ca9699',
  },
  entities: {
    id: 'entities',
    required: false,
    url: resourceArtifactUrl('databases/bible_entities.production.sqlite.zip'),
    entry: 'bible_entities.production.sqlite',
    archiveBytes: 5_369_907,
    archiveSha256: '16ec0b12497180dc39042a4a818972c599ab9d5f79c6880a765b2ab8aaed0e09',
    contentBytes: 19_873_792,
    contentSha256: '21816c1d9d3190a16ffcfbf3b53cc47a17e860fe93ab4d81f2fad877c63b07e1',
    resourceRevision: 'strong-lexicon-entities-8235604fb1a30e9714b32a69',
    coreRevision: 'strong-lexicon-core-4392debcb0c9fb65d2ca9699',
  },
}

export const getStrongLexiconPublication = (
  moduleId: StrongLexiconModuleId
): StrongLexiconPublicationArtifact => STRONG_LEXICON_PUBLICATIONS[moduleId]
