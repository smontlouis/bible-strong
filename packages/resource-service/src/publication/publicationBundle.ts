import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

import { Schema } from 'effect'
import { unzipSync } from 'fflate'
import initSqlJs, { type Database } from 'sql.js'
import { buildCanonicalBibleFromLegacy, hashCanonicalVerses } from './legacyBiblePublication'

import {
  BibleVersePresentationDto,
  type BibleVersePresentation,
} from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import {
  getStrongBibleCatalogIdentity,
  isStrongBibleVersionId,
} from '@bible-strong/resource-catalog/strong-bibles'
import { STRONG_IDENTITY_KINDS } from '@bible-strong/resource-domain/strong-identities'

const Sha256 = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const Language = Schema.String.pipe(Schema.pattern(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/))
const CommentaryResourceId = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/))
const DictionaryResourceId = Schema.String.pipe(Schema.pattern(/^[A-Z0-9][A-Z0-9_]{1,63}$/))
const DictionaryWorkId = Schema.String.pipe(Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
const CommentaryOfflineEntry = Schema.String.pipe(
  Schema.pattern(/^(?:commentaires-mhy|commentary-[a-z0-9][a-z0-9-]*-(?:fr|en))\.sqlite$/)
)
const Artifact = Schema.Struct({
  path: Schema.NonEmptyString,
  mediaType: Schema.NonEmptyString,
  sha256: Sha256,
  bytes: Schema.NonNegativeInt,
})
const OfflineEntry = Schema.Struct({
  entry: Schema.NonEmptyString,
  sha256: Sha256,
  bytes: Schema.NonNegativeInt,
})

const PublicationBundleCommonFields = {
  format: Schema.Literal('bible-strong-resource-publication'),
  schemaVersion: Schema.Literal(1),
  revision: Schema.NonEmptyString,
  publicationRevision: Schema.optional(Schema.NonEmptyString),
  canonical: Schema.Struct({
    ...Artifact.fields,
    mediaType: Schema.Literal('application/json'),
    schemaVersion: Schema.NonNegativeInt,
  }),
  offlineArtifact: Schema.Struct({
    ...Artifact.fields,
    mediaType: Schema.Literal('application/zip'),
    entry: Schema.NonEmptyString,
    contentSha256: Sha256,
    entries: Schema.optional(
      Schema.Struct({
        canonical: OfflineEntry,
        pericope: Schema.optional(OfflineEntry),
        redWords: Schema.optional(OfflineEntry),
      })
    ),
  }),
  provenance: Schema.Struct({
    generator: Schema.Literal('bible-lexicon-maker'),
    sourceVersion: Schema.NonEmptyString,
    sourceSha256: Sha256,
    generatedAt: Schema.NonEmptyString,
    sources: Schema.optional(
      Schema.Array(
        Schema.Struct({
          role: Schema.Literal('canonical', 'pericope', 'redWords'),
          sourceUrl: Schema.NonEmptyString,
          sha256: Sha256,
        })
      )
    ),
  }),
  rights: Schema.Struct({
    holder: Schema.NonEmptyString,
    termsReference: Schema.NonEmptyString,
    attribution: Schema.NonEmptyString,
    reviewedAt: Schema.optional(Schema.NonEmptyString),
    online: Schema.Boolean,
    offline: Schema.Boolean,
  }),
  deliveryCapabilities: Schema.Struct({
    onlineAccess: Schema.Boolean,
    offlineDownload: Schema.Boolean,
    localDevelopmentAccess: Schema.optional(Schema.Boolean),
  }),
}

const BiblePublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  identity: Schema.Struct({
    kind: Schema.Literal('bible-text'),
    versionId: Schema.NonEmptyString,
    language: Language,
  }),
  canon: Schema.Struct({
    id: Schema.NonEmptyString,
    orderedBooks: Schema.Array(Schema.Int.pipe(Schema.positive())),
  }),
  versification: Schema.NonEmptyString,
  coverage: Schema.Struct({
    chaptersByBook: Schema.Record({
      key: Schema.String,
      value: Schema.Array(Schema.Int.pipe(Schema.positive())),
    }),
    verseCountByBookChapter: Schema.Record({
      key: Schema.String,
      value: Schema.Int.pipe(Schema.positive()),
    }),
  }),
  counts: Schema.Struct({
    books: Schema.NonNegativeInt,
    chapters: Schema.NonNegativeInt,
    verses: Schema.NonNegativeInt,
    notes: Schema.NonNegativeInt,
    headings: Schema.NonNegativeInt,
  }),
})

const NavePublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  offlineArtifact: Schema.Struct({
    ...PublicationBundleCommonFields.offlineArtifact.fields,
    entry: Schema.Literal('nave-fr.sqlite', 'nave.sqlite'),
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('nave'),
    resourceId: Schema.Literal('NAVE_FR', 'NAVE_EN'),
    language: Schema.Literal('fr', 'en'),
  }),
  alphabeticalBrowse: Schema.Struct({
    initials: Schema.Array(Schema.NonEmptyString),
    topicCountByInitial: Schema.Record({
      key: Schema.String,
      value: Schema.NonNegativeInt,
    }),
  }),
  counts: Schema.Struct({
    topics: Schema.NonNegativeInt,
    verseAnchors: Schema.NonNegativeInt,
    topicReferences: Schema.NonNegativeInt,
  }),
})

const DictionaryPublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  canonical: Schema.Struct({
    ...PublicationBundleCommonFields.canonical.fields,
    schemaVersion: Schema.Literal(2),
  }),
  offlineArtifact: Schema.Struct({
    ...PublicationBundleCommonFields.offlineArtifact.fields,
    entry: Schema.Literal('dictionnaire.sqlite'),
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('dictionary'),
    resourceId: DictionaryResourceId,
    work: DictionaryWorkId,
    language: Schema.Literal('fr', 'en'),
  }),
  editorial: Schema.Struct({
    title: Schema.NonEmptyString,
    abbreviation: Schema.NonEmptyString,
    authors: Schema.NonEmptyArray(Schema.NonEmptyString),
    description: Schema.NonEmptyString,
    edition: Schema.NonEmptyString,
    source: Schema.NonEmptyString,
  }),
  alphabeticalBrowse: Schema.Struct({
    initials: Schema.Array(Schema.NonEmptyString),
    entryCountByInitial: Schema.Record({
      key: Schema.String,
      value: Schema.NonNegativeInt,
    }),
  }),
  counts: Schema.Struct({
    entries: Schema.NonNegativeInt,
    verseAnchors: Schema.NonNegativeInt,
    wordReferences: Schema.NonNegativeInt,
    passageEntryReferences: Schema.optional(Schema.NonNegativeInt),
  }),
})

const DictionaryDirectoryPublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  canonical: Schema.Struct({
    ...PublicationBundleCommonFields.canonical.fields,
    schemaVersion: Schema.Literal(1),
  }),
  offlineArtifact: Schema.Struct({
    ...PublicationBundleCommonFields.offlineArtifact.fields,
    entry: Schema.Literal('dictionary-directory.sqlite'),
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('dictionary-directory'),
    resourceId: Schema.Literal('DICTIONARY_DIRECTORY'),
    language: Schema.Literal('mul'),
  }),
  counts: Schema.Struct({
    works: Schema.NonNegativeInt,
    entries: Schema.NonNegativeInt,
    correspondences: Schema.NonNegativeInt,
    passageAnchors: Schema.NonNegativeInt,
  }),
})

const CommentaryPublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  canonical: Schema.Struct({
    ...PublicationBundleCommonFields.canonical.fields,
    schemaVersion: Schema.Literal(1, 2),
  }),
  offlineArtifact: Schema.Struct({
    ...PublicationBundleCommonFields.offlineArtifact.fields,
    entry: CommentaryOfflineEntry,
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('commentary'),
    resourceId: CommentaryResourceId,
    language: Schema.Literal('fr', 'en'),
  }),
  counts: Schema.Struct({
    chapters: Schema.NonNegativeInt,
    verses: Schema.NonNegativeInt,
    characters: Schema.NonNegativeInt,
  }),
})

const CrossReferencePublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  canonical: Schema.Struct({
    ...PublicationBundleCommonFields.canonical.fields,
    schemaVersion: Schema.Literal(1),
  }),
  offlineArtifact: Schema.Struct({
    ...PublicationBundleCommonFields.offlineArtifact.fields,
    entry: Schema.Literal('commentaires-tresor.sqlite'),
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('cross-references'),
    resourceId: Schema.Literal('TRESOR'),
    language: Schema.Literal('fr'),
  }),
  counts: Schema.Struct({
    verseAnchors: Schema.NonNegativeInt,
    references: Schema.NonNegativeInt,
  }),
})

const TimelinePublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  canonical: Schema.Struct({
    ...PublicationBundleCommonFields.canonical.fields,
    schemaVersion: Schema.Literal(1),
  }),
  offlineArtifact: Schema.Struct({
    ...PublicationBundleCommonFields.offlineArtifact.fields,
    entry: Schema.Literal('bible-timeline-events.json'),
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('timeline'),
    resourceId: Schema.Literal('TIMELINE'),
    language: Schema.Literal('fr', 'en'),
  }),
  counts: Schema.Struct({
    events: Schema.NonNegativeInt,
    relations: Schema.NonNegativeInt,
    scriptures: Schema.NonNegativeInt,
  }),
})

const StrongBiblePublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  identity: Schema.Struct({
    kind: Schema.Literal('strong-bible-index'),
    versionId: Schema.NonEmptyString,
    datasetId: Schema.NonEmptyString,
    language: Language,
  }),
  dependencies: Schema.Struct({
    bible: Schema.Struct({
      resourceIdentity: Schema.NonEmptyString,
      revision: Schema.NonEmptyString,
      textSha256: Sha256,
      online: Schema.Literal('required'),
      offline: Schema.Literal('required'),
    }),
    strongLexiconModules: Schema.Array(
      Schema.Struct({
        resourceIdentity: Schema.NonEmptyString,
        online: Schema.Literal('required-for-lexical-details'),
        offline: Schema.Literal('required-for-lexical-details'),
      })
    ),
  }),
  counts: Schema.Struct({
    verses: Schema.NonNegativeInt,
    occurrences: Schema.NonNegativeInt,
    unalignedOccurrences: Schema.NonNegativeInt,
    identities: Schema.NonNegativeInt,
    lexemeAssignments: Schema.NonNegativeInt,
    lexemes: Schema.NonNegativeInt,
  }),
})

const InterlinearBiblePublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  identity: Schema.Struct({
    kind: Schema.Literal('interlinear-index'),
    versionId: Schema.Literal('BHG'),
    datasetId: Schema.Literal('STEP'),
    language: Schema.Literal('fr', 'en'),
  }),
  dependencies: Schema.Struct({
    bible: Schema.Struct({
      resourceIdentity: Schema.Literal('bible-text:BHG'),
      revision: Schema.NonEmptyString,
      textSha256: Sha256,
      online: Schema.Literal('required'),
      offline: Schema.Literal('required'),
    }),
    strongLexiconModules: Schema.Array(
      Schema.Struct({
        resourceIdentity: Schema.NonEmptyString,
        online: Schema.Literal('required-for-lexical-details'),
        offline: Schema.Literal('required-for-lexical-details'),
      })
    ),
  }),
  counts: Schema.Struct({
    verses: Schema.NonNegativeInt,
    tokens: Schema.NonNegativeInt,
    segments: Schema.NonNegativeInt,
    identities: Schema.NonNegativeInt,
  }),
})

const StrongLexiconModuleId = Schema.Literal('core', 'resources', 'entities')
const STRONG_LEXICON_MODULE_ENTRIES = {
  core: 'strong_lexicon.core.sqlite',
  resources: 'strong_lexicon.resources.sqlite',
  entities: 'bible_entities.production.sqlite',
} as const
const StrongLexiconPublicationBundleManifestSchema = Schema.Struct({
  ...PublicationBundleCommonFields,
  canonical: Schema.Struct({
    ...PublicationBundleCommonFields.canonical.fields,
    schemaVersion: Schema.Literal(1, 2),
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('strong-lexicon-module'),
    moduleId: StrongLexiconModuleId,
    resourceId: Schema.Literal(
      'strong-lexicon:core',
      'strong-lexicon:resources',
      'strong-lexicon:entities'
    ),
    language: Schema.Literal('mul'),
  }),
  dependencies: Schema.Array(
    Schema.Struct({
      resourceIdentity: Schema.Literal('strong-lexicon:core'),
      revision: Schema.NonEmptyString,
    })
  ),
  counts: Schema.Record({ key: Schema.String, value: Schema.NonNegativeInt }),
})

const PublicationBundleManifestSchema = Schema.Union(
  BiblePublicationBundleManifestSchema,
  NavePublicationBundleManifestSchema,
  DictionaryPublicationBundleManifestSchema,
  DictionaryDirectoryPublicationBundleManifestSchema,
  CommentaryPublicationBundleManifestSchema,
  CrossReferencePublicationBundleManifestSchema,
  TimelinePublicationBundleManifestSchema,
  StrongBiblePublicationBundleManifestSchema,
  InterlinearBiblePublicationBundleManifestSchema,
  StrongLexiconPublicationBundleManifestSchema
)

export type BiblePublicationBundleManifest = typeof BiblePublicationBundleManifestSchema.Type
export type NavePublicationBundleManifest = typeof NavePublicationBundleManifestSchema.Type
export type DictionaryPublicationBundleManifest =
  typeof DictionaryPublicationBundleManifestSchema.Type
export type DictionaryDirectoryPublicationBundleManifest =
  typeof DictionaryDirectoryPublicationBundleManifestSchema.Type
export type CommentaryPublicationBundleManifest =
  typeof CommentaryPublicationBundleManifestSchema.Type
export type CrossReferencePublicationBundleManifest =
  typeof CrossReferencePublicationBundleManifestSchema.Type
export type TimelinePublicationBundleManifest = typeof TimelinePublicationBundleManifestSchema.Type
export type StrongBiblePublicationBundleManifest =
  typeof StrongBiblePublicationBundleManifestSchema.Type
export type InterlinearBiblePublicationBundleManifest =
  typeof InterlinearBiblePublicationBundleManifestSchema.Type
export type StrongLexiconPublicationBundleManifest =
  typeof StrongLexiconPublicationBundleManifestSchema.Type
export type PublicationBundleManifest =
  | BiblePublicationBundleManifest
  | NavePublicationBundleManifest
  | DictionaryPublicationBundleManifest
  | DictionaryDirectoryPublicationBundleManifest
  | CommentaryPublicationBundleManifest
  | CrossReferencePublicationBundleManifest
  | TimelinePublicationBundleManifest
  | StrongBiblePublicationBundleManifest
  | InterlinearBiblePublicationBundleManifest
  | StrongLexiconPublicationBundleManifest

export const isBiblePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is BiblePublicationBundleManifest => manifest.identity.kind === 'bible-text'

export const isNavePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is NavePublicationBundleManifest => manifest.identity.kind === 'nave'

export const isDictionaryPublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is DictionaryPublicationBundleManifest => manifest.identity.kind === 'dictionary'

export const isDictionaryDirectoryPublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is DictionaryDirectoryPublicationBundleManifest =>
  manifest.identity.kind === 'dictionary-directory'

export const isCommentaryPublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is CommentaryPublicationBundleManifest => manifest.identity.kind === 'commentary'

export const isCrossReferencePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is CrossReferencePublicationBundleManifest =>
  manifest.identity.kind === 'cross-references'

export const isTimelinePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is TimelinePublicationBundleManifest => manifest.identity.kind === 'timeline'

export const isStrongBiblePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is StrongBiblePublicationBundleManifest =>
  manifest.identity.kind === 'strong-bible-index'

export const isInterlinearBiblePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is InterlinearBiblePublicationBundleManifest =>
  manifest.identity.kind === 'interlinear-index'

export const isStrongLexiconPublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is StrongLexiconPublicationBundleManifest =>
  manifest.identity.kind === 'strong-lexicon-module'

export type CanonicalBibleVerse = BibleVersePresentation & {
  text: string
}

export type CanonicalBiblePublication = {
  format: 'bible-strong-canonical-bible'
  schemaVersion: number
  applicationVersionId: string
  textRevision: string
  textSha256: string
  sourceVersion: string
  sourceSha256: string
  verseCount: number
  noteCount: number
  headingCount: number
  verses: Record<string, Record<string, Record<string, CanonicalBibleVerse>>>
}

export type CanonicalNaveTopic = {
  normalizedName: string
  name: string
  initial: string
  description: string
}

export type CanonicalNaveVerseAnchor = {
  verseKey: string
  topicNormalizedNames: string[]
}

export type CanonicalNavePublication = {
  format: 'bible-strong-canonical-nave'
  schemaVersion: 1
  resourceId: 'NAVE_FR' | 'NAVE_EN'
  revision: string
  sourceVersion: string
  sourceSha256: string
  topics: CanonicalNaveTopic[]
  verseAnchors: CanonicalNaveVerseAnchor[]
}

export type CanonicalDictionaryEntry = {
  id: number
  word: string
  normalizedWord: string
  definition: string
  correspondenceId?: string
}

export type CanonicalDictionaryVerseAnchor = {
  verseKey: string
  words: string[]
}

export type CanonicalDictionaryPassageAnchor = {
  verseKey: string
  entries: Array<{
    entryId: number
    evidenceKind: 'source-citation' | 'verse-name' | 'verse-phrase'
  }>
}

export type CanonicalDictionaryPublication = {
  format: 'bible-strong-canonical-dictionary'
  schemaVersion: 2
  resourceId: string
  work: string
  language: 'fr' | 'en'
  editorial: {
    title: string
    abbreviation: string
    authors: string[]
    description: string
    edition: string
    source: string
  }
  revision: string
  sourceVersion: string
  sourceSha256: string
  entries: CanonicalDictionaryEntry[]
  verseAnchors: CanonicalDictionaryVerseAnchor[]
  passageAnchors?: CanonicalDictionaryPassageAnchor[]
}

export type CanonicalDictionaryDirectoryPublication = {
  format: 'bible-strong-canonical-dictionary-directory'
  schemaVersion: 1
  revision: string
  contentSha256: string
  counts: {
    works: number
    entries: number
    correspondences: number
    passageAnchors: number
  }
}

export type CanonicalCommentaryPublicationV1 = {
  format: 'bible-strong-canonical-commentary'
  schemaVersion: 1
  resourceId: string
  language: 'fr' | 'en'
  revision: string
  sourceVersion: string
  sourceSha256: string
  verses: Array<{ verseKey: string; content: string }>
}

export type CanonicalCommentaryPublicationV2 = {
  format: 'bible-strong-canonical-commentary'
  schemaVersion: 2
  resourceId: string
  language: 'fr' | 'en'
  revision: string
  sourceVersion: string
  sourceSha256: string
  documents: Array<{ id: string; content: string }>
  verses: Array<{ verseKey: string; documentIds: string[] }>
}

export type CanonicalCommentaryPublication =
  | CanonicalCommentaryPublicationV1
  | CanonicalCommentaryPublicationV2

export type CanonicalCrossReferencePublication = {
  format: 'bible-strong-canonical-cross-references'
  schemaVersion: 1
  resourceId: 'TRESOR'
  language: 'fr'
  revision: string
  sourceVersion: string
  sourceSha256: string
  verseAnchors: Array<{ verseKey: string; references: string[] }>
}

export type CanonicalTimelineEvent = {
  id: string
  slug: string
  title: string
  description: string
  article: string
  period: string
  dates: string
  related: Array<{ slug: string; title: string }>
  images: Array<{ caption: string; file: string }>
  videos: Array<{ title: string; caption: string; filename: string }>
  scriptures: string[]
}

export type CanonicalTimelinePublication = {
  format: 'bible-strong-canonical-timeline'
  schemaVersion: 1
  resourceId: 'TIMELINE'
  language: 'fr' | 'en'
  revision: string
  sourceVersion: string
  sourceSha256: string
  events: CanonicalTimelineEvent[]
}

export type CanonicalStrongBibleVerse = { book: number; chapter: number; verse: number }
export type CanonicalStrongBibleLexeme = { id: number; lemma: string; partOfSpeech: string }
export type CanonicalStrongBibleIdentity = {
  id: number
  kind: 'strong' | 'estrong' | 'dstrong' | 'ustrong'
  code: string
}
export type CanonicalStrongBibleSpan = CanonicalStrongBibleVerse & {
  ordinal: number
  startOffset: number
  length: number
  isAligned: boolean
  lexemeId?: number
  stepTokenIds?: number[]
}
export type CanonicalStrongBibleSpanIdentity = CanonicalStrongBibleVerse & {
  ordinal: number
  identityOrder: number
  identityId: number
}
export type CanonicalStrongBiblePublication = {
  format: 'bible-strong-canonical-strong-index'
  schemaVersion: 1
  applicationVersionId: string
  datasetId: string
  textRevision: string
  textSha256: string
  strongRevision: string
  verses: CanonicalStrongBibleVerse[]
  lexemes: CanonicalStrongBibleLexeme[]
  identities: CanonicalStrongBibleIdentity[]
  spans: CanonicalStrongBibleSpan[]
  spanIdentities: CanonicalStrongBibleSpanIdentity[]
}

export type CanonicalInterlinearBibleVerse = {
  id: number
  book: number
  chapter: number
  verse: number
}
export type CanonicalInterlinearBibleToken = {
  id: number
  verseId: number
  ordinal: number
  startOffset: number
  length: number
}
export type CanonicalInterlinearBibleSegment = {
  id: number
  tokenId: number
  ordinal: number
  startOffset: number
  length: number
  transliteration: string
  lemma: string
  morphology: string
  gloss: string
}
export type CanonicalInterlinearBibleSegmentIdentity = {
  segmentId: number
  identityOrder: number
  kind: 'strong' | 'estrong' | 'dstrong' | 'ustrong'
  code: string
}
export type CanonicalInterlinearBiblePublication = {
  format: 'bible-strong-canonical-interlinear-index'
  schemaVersion: 1
  applicationVersionId: 'BHG'
  datasetId: 'STEP'
  language: 'fr' | 'en'
  indexRevision: string
  textRevision: string
  textSha256: string
  verses: CanonicalInterlinearBibleVerse[]
  tokens: CanonicalInterlinearBibleToken[]
  segments: CanonicalInterlinearBibleSegment[]
  segmentIdentities: CanonicalInterlinearBibleSegmentIdentity[]
}

export type CanonicalPublication =
  | CanonicalBiblePublication
  | CanonicalNavePublication
  | CanonicalDictionaryPublication
  | CanonicalDictionaryDirectoryPublication
  | CanonicalCommentaryPublication
  | CanonicalCrossReferencePublication
  | CanonicalTimelinePublication
  | CanonicalStrongBiblePublication
  | CanonicalInterlinearBiblePublication
  | CanonicalStrongLexiconModulePublication

export type CanonicalStrongLexiconModulePublication = {
  format: 'bible-strong-canonical-strong-lexicon-module'
  schemaVersion: 1 | 2
  moduleId: 'core' | 'resources' | 'entities'
  revision: string
  dependencies: { resourceIdentity: 'strong-lexicon:core'; revision: string }[]
  tables: Record<string, Record<string, string | number | null>[]>
  counts: Record<string, number>
}

const normalizeJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, normalizeJson(nested)])
    )
  }
  return value
}

export const derivePublicationRevision = (manifest: PublicationBundleManifest): string => {
  const { publicationRevision, ...envelope } = manifest
  const resourceId =
    manifest.identity.kind === 'nave'
      ? manifest.identity.resourceId.toLowerCase()
      : manifest.identity.kind === 'dictionary'
        ? `dictionary-${manifest.identity.work}-${manifest.identity.language}`
        : manifest.identity.kind === 'dictionary-directory'
          ? 'dictionary-directory'
          : manifest.identity.kind === 'commentary'
            ? `commentary-${manifest.identity.resourceId.toLowerCase()}-${manifest.identity.language}`
            : manifest.identity.kind === 'cross-references'
              ? `cross-references-${manifest.identity.language}`
              : manifest.identity.kind === 'timeline'
                ? `timeline-${manifest.identity.language}`
                : manifest.identity.kind === 'strong-lexicon-module'
                  ? manifest.identity.resourceId
                  : manifest.identity.versionId.toLowerCase()
  const digest = createHash('sha256')
    .update(JSON.stringify(normalizeJson(envelope)))
    .digest('hex')
  return `${resourceId}-${digest.slice(0, 20)}`
}

const validatePublicationRevision = (manifest: PublicationBundleManifest) => {
  if (!manifest.publicationRevision) return
  if (manifest.publicationRevision !== derivePublicationRevision(manifest)) {
    throw new Error('PUBLICATION_BUNDLE_REVISION_INVALID')
  }
}

const isSafeBundlePath = (value: string): boolean =>
  !path.isAbsolute(value) &&
  !value.includes('\\') &&
  value.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..')

export const decodePublicationBundleManifest = (value: unknown): PublicationBundleManifest => {
  let manifest: PublicationBundleManifest
  try {
    manifest = Schema.decodeUnknownSync(PublicationBundleManifestSchema)(value)
  } catch (cause) {
    throw new Error('PUBLICATION_BUNDLE_MANIFEST_INVALID', { cause })
  }

  validatePublicationRevision(manifest)

  if (
    !isSafeBundlePath(manifest.canonical.path) ||
    !isSafeBundlePath(manifest.offlineArtifact.path) ||
    !isSafeBundlePath(manifest.offlineArtifact.entry)
  ) {
    throw new Error('PUBLICATION_BUNDLE_PATH_INVALID')
  }
  if (
    manifest.offlineArtifact.entries &&
    Object.values(manifest.offlineArtifact.entries).some(
      entry => entry && !isSafeBundlePath(entry.entry)
    )
  ) {
    throw new Error('PUBLICATION_BUNDLE_PATH_INVALID')
  }
  if (
    (manifest.deliveryCapabilities.onlineAccess && !manifest.rights.online) ||
    (manifest.deliveryCapabilities.offlineDownload && !manifest.rights.offline)
  ) {
    throw new Error('PUBLICATION_BUNDLE_RIGHTS_MISMATCH')
  }
  if (
    isNavePublicationBundleManifest(manifest) &&
    (manifest.identity.resourceId !==
      (manifest.identity.language === 'fr' ? 'NAVE_FR' : 'NAVE_EN') ||
      manifest.offlineArtifact.entry !==
        (manifest.identity.language === 'fr' ? 'nave-fr.sqlite' : 'nave.sqlite'))
  ) {
    throw new Error('PUBLICATION_BUNDLE_MANIFEST_INVALID')
  }
  if (
    isBiblePublicationBundleManifest(manifest) &&
    (manifest.canon.orderedBooks.length === 0 ||
      Object.values(manifest.coverage.chaptersByBook).some(chapters => chapters.length === 0))
  ) {
    throw new Error('PUBLICATION_BUNDLE_COVERAGE_INVALID')
  }
  if (
    isNavePublicationBundleManifest(manifest) &&
    (manifest.alphabeticalBrowse.initials.length === 0 ||
      Object.values(manifest.alphabeticalBrowse.topicCountByInitial).some(count => count === 0))
  ) {
    throw new Error('PUBLICATION_BUNDLE_ALPHABETICAL_BROWSE_INVALID')
  }
  if (
    isCommentaryPublicationBundleManifest(manifest) &&
    (manifest.offlineArtifact.entry !==
      (manifest.identity.resourceId === 'MHY' && manifest.identity.language === 'fr'
        ? 'commentaires-mhy.sqlite'
        : `commentary-${manifest.identity.resourceId.toLowerCase()}-${manifest.identity.language}.sqlite`) ||
      manifest.counts.verses === 0)
  ) {
    throw new Error('PUBLICATION_BUNDLE_MANIFEST_INVALID')
  }
  if (
    isCrossReferencePublicationBundleManifest(manifest) &&
    (manifest.identity.resourceId !== 'TRESOR' ||
      manifest.offlineArtifact.entry !== 'commentaires-tresor.sqlite' ||
      manifest.counts.verseAnchors === 0)
  ) {
    throw new Error('PUBLICATION_BUNDLE_MANIFEST_INVALID')
  }
  if (
    isTimelinePublicationBundleManifest(manifest) &&
    (manifest.offlineArtifact.entry !== 'bible-timeline-events.json' ||
      manifest.counts.events === 0)
  ) {
    throw new Error('PUBLICATION_BUNDLE_MANIFEST_INVALID')
  }
  if (
    isDictionaryPublicationBundleManifest(manifest) &&
    (manifest.alphabeticalBrowse.initials.length === 0 ||
      Object.values(manifest.alphabeticalBrowse.entryCountByInitial).some(count => count === 0) ||
      manifest.counts.entries === 0)
  ) {
    throw new Error('PUBLICATION_BUNDLE_ALPHABETICAL_BROWSE_INVALID')
  }
  if (
    isDictionaryDirectoryPublicationBundleManifest(manifest) &&
    (manifest.offlineArtifact.entry !== 'dictionary-directory.sqlite' ||
      manifest.counts.works === 0 ||
      manifest.counts.entries === 0)
  ) {
    throw new Error('PUBLICATION_BUNDLE_MANIFEST_INVALID')
  }
  if (
    isStrongBiblePublicationBundleManifest(manifest) &&
    (!isStrongBibleVersionId(manifest.identity.versionId) ||
      manifest.identity.datasetId !==
        getStrongBibleCatalogIdentity(manifest.identity.versionId).datasetId ||
      manifest.identity.language !==
        getStrongBibleCatalogIdentity(manifest.identity.versionId).language ||
      manifest.dependencies.bible.resourceIdentity !==
        `bible-text:${manifest.identity.versionId}` ||
      !manifest.dependencies.strongLexiconModules.some(
        dependency => dependency.resourceIdentity === 'strong-lexicon:core'
      ))
  ) {
    throw new Error('PUBLICATION_BUNDLE_DEPENDENCY_INVALID')
  }
  if (
    isInterlinearBiblePublicationBundleManifest(manifest) &&
    (manifest.offlineArtifact.entry !==
      `bible-step-interlinear-${manifest.identity.language}.sqlite` ||
      manifest.canonical.schemaVersion !== 1 ||
      !manifest.dependencies.strongLexiconModules.some(
        dependency => dependency.resourceIdentity === 'strong-lexicon:core'
      ))
  ) {
    throw new Error('PUBLICATION_BUNDLE_DEPENDENCY_INVALID')
  }
  if (isStrongLexiconPublicationBundleManifest(manifest)) {
    const expectedResourceId = `strong-lexicon:${manifest.identity.moduleId}`
    if (
      manifest.offlineArtifact.entry !== STRONG_LEXICON_MODULE_ENTRIES[manifest.identity.moduleId]
    ) {
      throw new Error('PUBLICATION_BUNDLE_OFFLINE_ENTRY_INVALID')
    }
    const dependency = manifest.dependencies[0]
    if (
      manifest.identity.resourceId !== expectedResourceId ||
      (manifest.identity.moduleId === 'core'
        ? manifest.dependencies.length !== 0
        : manifest.dependencies.length !== 1 ||
          dependency?.resourceIdentity !== 'strong-lexicon:core')
    ) {
      throw new Error('PUBLICATION_BUNDLE_DEPENDENCY_INVALID')
    }
  }

  return manifest
}

const fileSha256 = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })

const assertArtifact = async (
  filePath: string,
  artifact: { sha256: string; bytes: number },
  label: string,
  bundleRoot: string
) => {
  const [fileStat, resolvedFile, resolvedRoot] = await Promise.all([
    lstat(filePath),
    realpath(filePath),
    realpath(bundleRoot),
  ])
  if (!fileStat.isFile() || !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label}_PATH_INVALID`)
  }
  if (fileStat.size > 512 * 1024 * 1024) throw new Error(`${label}_SIZE_LIMIT_EXCEEDED`)
  if (fileStat.size !== artifact.bytes) throw new Error(`${label}_SIZE_MISMATCH`)
  if ((await fileSha256(filePath)) !== artifact.sha256) {
    throw new Error(`${label}_CHECKSUM_MISMATCH`)
  }
}

export const decodeCanonicalBible = (value: unknown): CanonicalBiblePublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_BIBLE_INVALID')
  const candidate = value as Partial<CanonicalBiblePublication>
  if (
    candidate.format !== 'bible-strong-canonical-bible' ||
    candidate.schemaVersion !== 4 ||
    typeof candidate.applicationVersionId !== 'string' ||
    typeof candidate.textRevision !== 'string' ||
    typeof candidate.textSha256 !== 'string' ||
    typeof candidate.sourceVersion !== 'string' ||
    typeof candidate.sourceSha256 !== 'string' ||
    !Number.isSafeInteger(candidate.verseCount) ||
    !Number.isSafeInteger(candidate.noteCount) ||
    !Number.isSafeInteger(candidate.headingCount) ||
    !candidate.verses ||
    typeof candidate.verses !== 'object'
  ) {
    throw new Error('CANONICAL_BIBLE_INVALID')
  }
  return candidate as CanonicalBiblePublication
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

export const decodeCanonicalNave = (value: unknown): CanonicalNavePublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_NAVE_INVALID')
  const candidate = value as Partial<CanonicalNavePublication>
  if (
    candidate.format !== 'bible-strong-canonical-nave' ||
    candidate.schemaVersion !== 1 ||
    (candidate.resourceId !== 'NAVE_FR' && candidate.resourceId !== 'NAVE_EN') ||
    !isNonEmptyString(candidate.revision) ||
    !isNonEmptyString(candidate.sourceVersion) ||
    !isNonEmptyString(candidate.sourceSha256) ||
    !/^[a-f0-9]{64}$/.test(candidate.sourceSha256) ||
    !Array.isArray(candidate.topics) ||
    !Array.isArray(candidate.verseAnchors)
  ) {
    throw new Error('CANONICAL_NAVE_INVALID')
  }

  const topicNames = new Set<string>()
  for (const topic of candidate.topics) {
    if (
      !topic ||
      !isNonEmptyString(topic.normalizedName) ||
      !isNonEmptyString(topic.name) ||
      !isNonEmptyString(topic.initial) ||
      typeof topic.description !== 'string'
    ) {
      throw new Error('CANONICAL_NAVE_TOPIC_INVALID')
    }
    if (topicNames.has(topic.normalizedName)) throw new Error('CANONICAL_NAVE_TOPIC_DUPLICATE')
    topicNames.add(topic.normalizedName)
  }

  const verseKeys = new Set<string>()
  for (const anchor of candidate.verseAnchors) {
    if (
      !anchor ||
      !isNonEmptyString(anchor.verseKey) ||
      !/^[1-9]\d*-[1-9]\d*(?:-[1-9]\d*)?$/.test(anchor.verseKey) ||
      !Array.isArray(anchor.topicNormalizedNames) ||
      anchor.topicNormalizedNames.length === 0 ||
      anchor.topicNormalizedNames.some(
        topicName => !isNonEmptyString(topicName) || !topicNames.has(topicName)
      )
    ) {
      throw new Error('CANONICAL_NAVE_LINK_INVALID')
    }
    if (verseKeys.has(anchor.verseKey)) throw new Error('CANONICAL_NAVE_ANCHOR_DUPLICATE')
    if (new Set(anchor.topicNormalizedNames).size !== anchor.topicNormalizedNames.length) {
      throw new Error('CANONICAL_NAVE_LINK_DUPLICATE')
    }
    verseKeys.add(anchor.verseKey)
  }

  return candidate as CanonicalNavePublication
}

export const decodeCanonicalDictionary = (value: unknown): CanonicalDictionaryPublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_DICTIONARY_INVALID')
  const candidate = value as Partial<CanonicalDictionaryPublication>
  if (
    candidate.format !== 'bible-strong-canonical-dictionary' ||
    candidate.schemaVersion !== 2 ||
    !isNonEmptyString(candidate.resourceId) ||
    !/^[A-Z0-9][A-Z0-9_]{1,63}$/u.test(candidate.resourceId) ||
    !isNonEmptyString(candidate.work) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(candidate.work) ||
    (candidate.language !== 'fr' && candidate.language !== 'en') ||
    !candidate.editorial ||
    !isNonEmptyString(candidate.editorial.title) ||
    !isNonEmptyString(candidate.editorial.abbreviation) ||
    !Array.isArray(candidate.editorial.authors) ||
    candidate.editorial.authors.length === 0 ||
    candidate.editorial.authors.some(author => !isNonEmptyString(author)) ||
    !isNonEmptyString(candidate.editorial.description) ||
    !isNonEmptyString(candidate.editorial.edition) ||
    !isNonEmptyString(candidate.editorial.source) ||
    !isNonEmptyString(candidate.revision) ||
    !isNonEmptyString(candidate.sourceVersion) ||
    !/^[a-f0-9]{64}$/u.test(candidate.sourceSha256 ?? '') ||
    !Array.isArray(candidate.entries) ||
    !Array.isArray(candidate.verseAnchors) ||
    candidate.entries.length === 0
  ) {
    throw new Error('CANONICAL_DICTIONARY_INVALID')
  }

  const entryIds = new Set<number>()
  for (const entry of candidate.entries) {
    if (
      !entry ||
      !isPositiveInteger(entry.id) ||
      !isNonEmptyString(entry.word) ||
      !isNonEmptyString(entry.normalizedWord) ||
      entry.normalizedWord !== entry.normalizedWord.trim().toLocaleLowerCase() ||
      typeof entry.definition !== 'string' ||
      (entry.correspondenceId !== undefined && !isNonEmptyString(entry.correspondenceId)) ||
      entryIds.has(entry.id)
    ) {
      throw new Error('CANONICAL_DICTIONARY_ENTRY_INVALID')
    }
    entryIds.add(entry.id)
  }

  const verseKeys = new Set<string>()
  for (const anchor of candidate.verseAnchors) {
    if (
      !anchor ||
      !isDictionaryVerseKey(anchor.verseKey) ||
      !Array.isArray(anchor.words) ||
      anchor.words.some(word => !isNonEmptyString(word)) ||
      verseKeys.has(anchor.verseKey)
    ) {
      throw new Error('CANONICAL_DICTIONARY_VERSE_INVALID')
    }
    verseKeys.add(anchor.verseKey)
  }
  if (candidate.passageAnchors !== undefined) {
    if (!Array.isArray(candidate.passageAnchors)) {
      throw new Error('CANONICAL_DICTIONARY_PASSAGE_INVALID')
    }
    const passageKeys = new Set<string>()
    for (const anchor of candidate.passageAnchors) {
      if (
        !anchor ||
        !isDictionaryVerseKey(anchor.verseKey) ||
        !Array.isArray(anchor.entries) ||
        anchor.entries.length === 0 ||
        passageKeys.has(anchor.verseKey)
      ) {
        throw new Error('CANONICAL_DICTIONARY_PASSAGE_INVALID')
      }
      passageKeys.add(anchor.verseKey)
      const identities = new Set<string>()
      for (const entry of anchor.entries) {
        const identity = `${entry?.entryId}:${entry?.evidenceKind}`
        if (
          !entry ||
          !isPositiveInteger(entry.entryId) ||
          !entryIds.has(entry.entryId) ||
          !['source-citation', 'verse-name', 'verse-phrase'].includes(entry.evidenceKind) ||
          identities.has(identity)
        ) {
          throw new Error('CANONICAL_DICTIONARY_PASSAGE_INVALID')
        }
        identities.add(identity)
      }
    }
  }
  return candidate as CanonicalDictionaryPublication
}

export const decodeCanonicalDictionaryDirectory = (
  value: unknown
): CanonicalDictionaryDirectoryPublication => {
  if (!value || typeof value !== 'object') {
    throw new Error('CANONICAL_DICTIONARY_DIRECTORY_INVALID')
  }
  const candidate = value as Partial<CanonicalDictionaryDirectoryPublication>
  const counts = candidate.counts
  if (
    candidate.format !== 'bible-strong-canonical-dictionary-directory' ||
    candidate.schemaVersion !== 1 ||
    !isNonEmptyString(candidate.revision) ||
    !/^[a-f0-9]{64}$/u.test(candidate.contentSha256 ?? '') ||
    !counts ||
    !isNonNegativeInteger(counts.works) ||
    !isNonNegativeInteger(counts.entries) ||
    !isNonNegativeInteger(counts.correspondences) ||
    !isNonNegativeInteger(counts.passageAnchors) ||
    counts.works === 0 ||
    counts.entries === 0
  ) {
    throw new Error('CANONICAL_DICTIONARY_DIRECTORY_INVALID')
  }
  return candidate as CanonicalDictionaryDirectoryPublication
}

const isSupplementaryVerseKey = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d*-(?:0-0|[1-9]\d*-(?:0|[1-9]\d*))$/u.test(value)

export const decodeCanonicalCommentary = (value: unknown): CanonicalCommentaryPublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_COMMENTARY_INVALID')
  const candidate = value as Partial<CanonicalCommentaryPublication>
  if (
    candidate.format !== 'bible-strong-canonical-commentary' ||
    (candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2) ||
    !isNonEmptyString(candidate.resourceId) ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/u.test(candidate.resourceId) ||
    (candidate.language !== 'fr' && candidate.language !== 'en') ||
    !isNonEmptyString(candidate.revision) ||
    !isNonEmptyString(candidate.sourceVersion) ||
    !/^[a-f0-9]{64}$/u.test(candidate.sourceSha256 ?? '') ||
    !Array.isArray(candidate.verses) ||
    candidate.verses.length === 0
  ) {
    throw new Error('CANONICAL_COMMENTARY_INVALID')
  }
  if (candidate.schemaVersion === 2) {
    if (!Array.isArray(candidate.documents) || candidate.documents.length === 0) {
      throw new Error('CANONICAL_COMMENTARY_INVALID')
    }
    const documentIds = new Set<string>()
    for (const document of candidate.documents) {
      if (
        !document ||
        !isNonEmptyString(document.id) ||
        !isNonEmptyString(document.content) ||
        documentIds.has(document.id)
      ) {
        throw new Error('CANONICAL_COMMENTARY_DOCUMENT_INVALID')
      }
      documentIds.add(document.id)
    }
    const keys = new Set<string>()
    for (const verse of candidate.verses) {
      if (
        !verse ||
        !isSupplementaryVerseKey(verse.verseKey) ||
        !Array.isArray(verse.documentIds) ||
        verse.documentIds.length === 0 ||
        new Set(verse.documentIds).size !== verse.documentIds.length ||
        verse.documentIds.some(id => !documentIds.has(id)) ||
        keys.has(verse.verseKey)
      ) {
        throw new Error('CANONICAL_COMMENTARY_VERSE_INVALID')
      }
      keys.add(verse.verseKey)
    }
    return candidate as CanonicalCommentaryPublicationV2
  }
  const keys = new Set<string>()
  for (const verse of candidate.verses as CanonicalCommentaryPublicationV1['verses']) {
    if (
      !verse ||
      !isSupplementaryVerseKey(verse.verseKey) ||
      typeof verse.content !== 'string' ||
      !verse.content.trim() ||
      keys.has(verse.verseKey)
    ) {
      throw new Error('CANONICAL_COMMENTARY_VERSE_INVALID')
    }
    keys.add(verse.verseKey)
  }
  return candidate as CanonicalCommentaryPublicationV1
}

export const commentaryVerseContent = (
  canonical: CanonicalCommentaryPublication,
  verse:
    | CanonicalCommentaryPublicationV1['verses'][number]
    | CanonicalCommentaryPublicationV2['verses'][number],
  documents = canonical.schemaVersion === 2
    ? new Map(canonical.documents.map(document => [document.id, document.content]))
    : new Map<string, string>()
): string => {
  if (canonical.schemaVersion === 1) {
    return (verse as CanonicalCommentaryPublicationV1['verses'][number]).content
  }
  return (verse as CanonicalCommentaryPublicationV2['verses'][number]).documentIds
    .map(id => documents.get(id) ?? '')
    .join('<hr>')
}

export const decodeCanonicalCrossReferences = (
  value: unknown
): CanonicalCrossReferencePublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_CROSS_REFERENCES_INVALID')
  const candidate = value as Partial<CanonicalCrossReferencePublication>
  if (
    candidate.format !== 'bible-strong-canonical-cross-references' ||
    candidate.schemaVersion !== 1 ||
    candidate.resourceId !== 'TRESOR' ||
    candidate.language !== 'fr' ||
    !isNonEmptyString(candidate.revision) ||
    !isNonEmptyString(candidate.sourceVersion) ||
    !/^[a-f0-9]{64}$/u.test(candidate.sourceSha256 ?? '') ||
    !Array.isArray(candidate.verseAnchors) ||
    candidate.verseAnchors.length === 0
  ) {
    throw new Error('CANONICAL_CROSS_REFERENCES_INVALID')
  }
  const keys = new Set<string>()
  for (const anchor of candidate.verseAnchors) {
    if (
      !anchor ||
      !isSupplementaryVerseKey(anchor.verseKey) ||
      !Array.isArray(anchor.references) ||
      anchor.references.length === 0 ||
      anchor.references.some(reference => typeof reference !== 'string' || !reference.trim()) ||
      keys.has(anchor.verseKey)
    ) {
      throw new Error('CANONICAL_CROSS_REFERENCES_ANCHOR_INVALID')
    }
    keys.add(anchor.verseKey)
  }
  return candidate as CanonicalCrossReferencePublication
}

export const decodeCanonicalTimeline = (value: unknown): CanonicalTimelinePublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_TIMELINE_INVALID')
  const candidate = value as Partial<CanonicalTimelinePublication>
  if (
    candidate.format !== 'bible-strong-canonical-timeline' ||
    candidate.schemaVersion !== 1 ||
    candidate.resourceId !== 'TIMELINE' ||
    (candidate.language !== 'fr' && candidate.language !== 'en') ||
    !isNonEmptyString(candidate.revision) ||
    !isNonEmptyString(candidate.sourceVersion) ||
    !/^[a-f0-9]{64}$/u.test(candidate.sourceSha256 ?? '') ||
    !Array.isArray(candidate.events) ||
    candidate.events.length === 0
  ) {
    throw new Error('CANONICAL_TIMELINE_INVALID')
  }
  const slugs = new Set<string>()
  const ids = new Set<string>()
  for (const event of candidate.events) {
    if (
      !event ||
      !isNonEmptyString(event.id) ||
      !isNonEmptyString(event.slug) ||
      !isNonEmptyString(event.title) ||
      typeof event.description !== 'string' ||
      typeof event.article !== 'string' ||
      typeof event.period !== 'string' ||
      typeof event.dates !== 'string' ||
      !Array.isArray(event.related) ||
      !Array.isArray(event.images) ||
      !Array.isArray(event.videos) ||
      !Array.isArray(event.scriptures) ||
      slugs.has(event.slug) ||
      ids.has(event.id)
    ) {
      throw new Error('CANONICAL_TIMELINE_EVENT_INVALID')
    }
    for (const related of event.related) {
      if (!related || !isNonEmptyString(related.slug) || !isNonEmptyString(related.title)) {
        throw new Error('CANONICAL_TIMELINE_RELATED_INVALID')
      }
    }
    for (const image of event.images) {
      if (!image || typeof image.caption !== 'string' || !isNonEmptyString(image.file)) {
        throw new Error('CANONICAL_TIMELINE_IMAGE_INVALID')
      }
    }
    for (const video of event.videos) {
      if (
        !video ||
        typeof video.title !== 'string' ||
        typeof video.caption !== 'string' ||
        !isNonEmptyString(video.filename)
      ) {
        throw new Error('CANONICAL_TIMELINE_VIDEO_INVALID')
      }
    }
    if (event.scriptures.some(scripture => typeof scripture !== 'string')) {
      throw new Error('CANONICAL_TIMELINE_SCRIPTURE_INVALID')
    }
    slugs.add(event.slug)
    ids.add(event.id)
  }
  return candidate as CanonicalTimelinePublication
}

const isPositiveInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0
const strongLocationKey = (location: CanonicalStrongBibleVerse) =>
  `${location.book}-${location.chapter}-${location.verse}`
const strongSpanKey = (span: CanonicalStrongBibleVerse & { ordinal: number }) =>
  `${strongLocationKey(span)}-${span.ordinal}`

export const decodeCanonicalStrongBible = (value: unknown): CanonicalStrongBiblePublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_STRONG_BIBLE_INVALID')
  const candidate = value as Partial<CanonicalStrongBiblePublication>
  if (
    candidate.format !== 'bible-strong-canonical-strong-index' ||
    candidate.schemaVersion !== 1 ||
    !isNonEmptyString(candidate.applicationVersionId) ||
    !isNonEmptyString(candidate.datasetId) ||
    !isNonEmptyString(candidate.textRevision) ||
    !isNonEmptyString(candidate.textSha256) ||
    !/^[a-f0-9]{64}$/.test(candidate.textSha256) ||
    !isNonEmptyString(candidate.strongRevision) ||
    !Array.isArray(candidate.verses) ||
    !Array.isArray(candidate.lexemes) ||
    !Array.isArray(candidate.identities) ||
    !Array.isArray(candidate.spans) ||
    !Array.isArray(candidate.spanIdentities)
  ) {
    throw new Error('CANONICAL_STRONG_BIBLE_INVALID')
  }

  const verseKeys = new Set<string>()
  for (const verse of candidate.verses) {
    if (
      !verse ||
      !isPositiveInteger(verse.book) ||
      !isPositiveInteger(verse.chapter) ||
      !isNonNegativeInteger(verse.verse)
    ) {
      throw new Error('CANONICAL_STRONG_BIBLE_VERSE_INVALID')
    }
    const key = strongLocationKey(verse)
    if (verseKeys.has(key)) throw new Error('CANONICAL_STRONG_BIBLE_VERSE_DUPLICATE')
    verseKeys.add(key)
  }

  const lexemeIds = new Set<number>()
  for (const lexeme of candidate.lexemes) {
    if (
      !lexeme ||
      !isPositiveInteger(lexeme.id) ||
      !isNonEmptyString(lexeme.lemma) ||
      !isNonEmptyString(lexeme.partOfSpeech)
    ) {
      throw new Error('CANONICAL_STRONG_BIBLE_LEXEME_INVALID')
    }
    if (lexemeIds.has(lexeme.id)) throw new Error('CANONICAL_STRONG_BIBLE_LEXEME_DUPLICATE')
    lexemeIds.add(lexeme.id)
  }

  const identityIds = new Set<number>()
  const identityCodes = new Set<string>()
  const identityKinds = new Set<string>(STRONG_IDENTITY_KINDS)
  for (const identity of candidate.identities) {
    if (
      !identity ||
      !isPositiveInteger(identity.id) ||
      !identityKinds.has(identity.kind) ||
      !isNonEmptyString(identity.code)
    ) {
      throw new Error('CANONICAL_STRONG_BIBLE_IDENTITY_INVALID')
    }
    if (identityIds.has(identity.id)) {
      throw new Error('CANONICAL_STRONG_BIBLE_IDENTITY_DUPLICATE')
    }
    const semanticKey = `${identity.kind}:${identity.code}`
    if (identityCodes.has(semanticKey)) {
      throw new Error('CANONICAL_STRONG_BIBLE_IDENTITY_DUPLICATE')
    }
    identityIds.add(identity.id)
    identityCodes.add(semanticKey)
  }

  const spanKeys = new Set<string>()
  for (const span of candidate.spans) {
    if (
      !span ||
      !verseKeys.has(strongLocationKey(span)) ||
      !isNonNegativeInteger(span.ordinal) ||
      !isNonNegativeInteger(span.startOffset) ||
      !isNonNegativeInteger(span.length) ||
      typeof span.isAligned !== 'boolean' ||
      span.isAligned !== span.length > 0 ||
      (span.lexemeId !== undefined && !lexemeIds.has(span.lexemeId)) ||
      (span.stepTokenIds !== undefined &&
        (!Array.isArray(span.stepTokenIds) ||
          span.stepTokenIds.some(stepTokenId => !isPositiveInteger(stepTokenId))))
    ) {
      throw new Error('CANONICAL_STRONG_BIBLE_SPAN_INVALID')
    }
    const key = strongSpanKey(span)
    if (spanKeys.has(key)) throw new Error('CANONICAL_STRONG_BIBLE_SPAN_DUPLICATE')
    spanKeys.add(key)
  }

  const spanIdentityKeys = new Set<string>()
  for (const spanIdentity of candidate.spanIdentities) {
    const spanKey = strongSpanKey(spanIdentity)
    if (
      !spanIdentity ||
      !spanKeys.has(spanKey) ||
      !isNonNegativeInteger(spanIdentity.identityOrder) ||
      !identityIds.has(spanIdentity.identityId)
    ) {
      throw new Error('CANONICAL_STRONG_BIBLE_SPAN_IDENTITY_INVALID')
    }
    const key = `${spanKey}-${spanIdentity.identityOrder}`
    if (spanIdentityKeys.has(key)) {
      throw new Error('CANONICAL_STRONG_BIBLE_SPAN_IDENTITY_DUPLICATE')
    }
    spanIdentityKeys.add(key)
  }

  return candidate as CanonicalStrongBiblePublication
}

export const decodeCanonicalInterlinearBible = (
  value: unknown
): CanonicalInterlinearBiblePublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_INTERLINEAR_INVALID')
  const candidate = value as Partial<CanonicalInterlinearBiblePublication>
  if (
    candidate.format !== 'bible-strong-canonical-interlinear-index' ||
    candidate.schemaVersion !== 1 ||
    candidate.applicationVersionId !== 'BHG' ||
    candidate.datasetId !== 'STEP' ||
    (candidate.language !== 'fr' && candidate.language !== 'en') ||
    !isNonEmptyString(candidate.indexRevision) ||
    !isNonEmptyString(candidate.textRevision) ||
    !isNonEmptyString(candidate.textSha256) ||
    !/^[a-f0-9]{64}$/.test(candidate.textSha256) ||
    !Array.isArray(candidate.verses) ||
    !Array.isArray(candidate.tokens) ||
    !Array.isArray(candidate.segments) ||
    !Array.isArray(candidate.segmentIdentities) ||
    candidate.verses.length === 0 ||
    candidate.tokens.length === 0 ||
    candidate.segments.length === 0 ||
    candidate.segmentIdentities.length === 0
  ) {
    throw new Error('CANONICAL_INTERLINEAR_INVALID')
  }

  const verseIds = new Set<number>()
  const verseLocations = new Set<string>()
  for (const verse of candidate.verses) {
    if (
      !verse ||
      !isPositiveInteger(verse.id) ||
      !isPositiveInteger(verse.book) ||
      !isPositiveInteger(verse.chapter) ||
      !isNonNegativeInteger(verse.verse)
    ) {
      throw new Error('CANONICAL_INTERLINEAR_VERSE_INVALID')
    }
    const location = `${verse.book}-${verse.chapter}-${verse.verse}`
    if (verseIds.has(verse.id) || verseLocations.has(location)) {
      throw new Error('CANONICAL_INTERLINEAR_VERSE_DUPLICATE')
    }
    verseIds.add(verse.id)
    verseLocations.add(location)
  }

  const tokenIds = new Set<number>()
  const tokenOrdinals = new Set<string>()
  const tokenById = new Map<number, CanonicalInterlinearBiblePublication['tokens'][number]>()
  for (const token of candidate.tokens) {
    if (
      !token ||
      !isPositiveInteger(token.id) ||
      !verseIds.has(token.verseId) ||
      !isNonNegativeInteger(token.ordinal) ||
      !isNonNegativeInteger(token.startOffset) ||
      !isNonNegativeInteger(token.length)
    ) {
      throw new Error('CANONICAL_INTERLINEAR_TOKEN_INVALID')
    }
    const ordinalKey = `${token.verseId}-${token.ordinal}`
    if (tokenIds.has(token.id) || tokenOrdinals.has(ordinalKey)) {
      throw new Error('CANONICAL_INTERLINEAR_TOKEN_DUPLICATE')
    }
    tokenIds.add(token.id)
    tokenOrdinals.add(ordinalKey)
    tokenById.set(token.id, token)
  }

  const segmentIds = new Set<number>()
  const segmentOrdinals = new Set<string>()
  for (const segment of candidate.segments) {
    const token = tokenById.get(segment.tokenId)
    if (
      !segment ||
      !isPositiveInteger(segment.id) ||
      !token ||
      !isNonNegativeInteger(segment.ordinal) ||
      !isNonNegativeInteger(segment.startOffset) ||
      !isNonNegativeInteger(segment.length) ||
      segment.startOffset + segment.length > token.length ||
      typeof segment.transliteration !== 'string' ||
      typeof segment.lemma !== 'string' ||
      typeof segment.morphology !== 'string' ||
      typeof segment.gloss !== 'string'
    ) {
      throw new Error('CANONICAL_INTERLINEAR_SEGMENT_INVALID')
    }
    const ordinalKey = `${segment.tokenId}-${segment.ordinal}`
    if (segmentIds.has(segment.id) || segmentOrdinals.has(ordinalKey)) {
      throw new Error('CANONICAL_INTERLINEAR_SEGMENT_DUPLICATE')
    }
    segmentIds.add(segment.id)
    segmentOrdinals.add(ordinalKey)
  }

  const identityKinds = new Set<string>(STRONG_IDENTITY_KINDS)
  const identityKeys = new Set<string>()
  for (const identity of candidate.segmentIdentities) {
    if (
      !identity ||
      !segmentIds.has(identity.segmentId) ||
      !isNonNegativeInteger(identity.identityOrder) ||
      !identityKinds.has(identity.kind) ||
      STRONG_IDENTITY_KINDS[identity.identityOrder] !== identity.kind ||
      !isNonEmptyString(identity.code)
    ) {
      throw new Error('CANONICAL_INTERLINEAR_IDENTITY_INVALID')
    }
    const key = `${identity.segmentId}-${identity.identityOrder}`
    if (identityKeys.has(key)) throw new Error('CANONICAL_INTERLINEAR_IDENTITY_DUPLICATE')
    identityKeys.add(key)
  }

  return candidate as CanonicalInterlinearBiblePublication
}

export const countCanonicalContent = (publication: CanonicalBiblePublication) => {
  let chapters = 0
  let verses = 0
  let notes = 0
  let headings = 0
  for (const [bookNumber, book] of Object.entries(publication.verses)) {
    if (!/^[1-9]\d*$/.test(bookNumber) || !book || typeof book !== 'object') {
      throw new Error('CANONICAL_VERSE_INVALID')
    }
    chapters += Object.keys(book).length
    for (const [chapterNumber, chapter] of Object.entries(book)) {
      if (!/^[1-9]\d*$/.test(chapterNumber) || !chapter || typeof chapter !== 'object') {
        throw new Error('CANONICAL_VERSE_INVALID')
      }
      for (const [verseNumber, verse] of Object.entries(chapter)) {
        if (!/^(?:0|[1-9]\d*)$/.test(verseNumber) || !verse || typeof verse.text !== 'string') {
          throw new Error('CANONICAL_VERSE_INVALID')
        }
        try {
          Schema.decodeUnknownSync(BibleVersePresentationDto)(verse)
        } catch (cause) {
          throw new Error('CANONICAL_VERSE_INVALID', { cause })
        }
        verses += 1
        notes += verse.notes.length
        headings += verse.headings.length
      }
    }
  }
  return { books: Object.keys(publication.verses).length, chapters, verses, notes, headings }
}

export const getCanonicalCoverage = (publication: CanonicalBiblePublication) => {
  const orderedBooks = Object.keys(publication.verses)
    .map(Number)
    .sort((left, right) => left - right)
  const chaptersByBook: Record<string, number[]> = {}
  const verseCountByBookChapter: Record<string, number> = {}
  for (const book of orderedBooks) {
    const chapters = publication.verses[String(book)] ?? {}
    const orderedChapters = Object.keys(chapters)
      .map(Number)
      .sort((left, right) => left - right)
    chaptersByBook[String(book)] = orderedChapters
    for (const chapter of orderedChapters) {
      verseCountByBookChapter[`${book}-${chapter}`] = Object.keys(
        chapters[String(chapter)] ?? {}
      ).length
    }
  }
  return { orderedBooks, chaptersByBook, verseCountByBookChapter }
}

export const countCanonicalNaveContent = (publication: CanonicalNavePublication) => ({
  topics: publication.topics.length,
  verseAnchors: publication.verseAnchors.length,
  topicReferences: publication.verseAnchors.reduce(
    (count, anchor) => count + anchor.topicNormalizedNames.length,
    0
  ),
})

const isDictionaryVerseKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 128 &&
  value === value.trim() &&
  value.split('-').length === 3 &&
  value.split('-').every(segment => segment.length > 0) &&
  !/[\\/\u0000-\u001f]/u.test(value)

export const deriveDictionaryResourceRevision = (
  publication: Pick<
    CanonicalDictionaryPublication,
    'work' | 'language' | 'entries' | 'verseAnchors' | 'passageAnchors'
  >
): string => {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        work: publication.work,
        language: publication.language,
        entries: publication.entries,
        verseAnchors: publication.verseAnchors,
        ...(publication.passageAnchors === undefined
          ? {}
          : { passageAnchors: publication.passageAnchors }),
      })
    )
    .digest('hex')
  return `dictionary-${publication.work}-${publication.language}-${digest.slice(0, 20)}`
}

export const countCanonicalDictionaryContent = (publication: CanonicalDictionaryPublication) => ({
  entries: publication.entries.length,
  verseAnchors: publication.verseAnchors.length,
  wordReferences: publication.verseAnchors.reduce(
    (count, anchor) => count + anchor.words.length,
    0
  ),
  ...(publication.passageAnchors === undefined
    ? {}
    : {
        passageEntryReferences: publication.passageAnchors.reduce(
          (count, anchor) => count + anchor.entries.length,
          0
        ),
      }),
})

export const getCanonicalDictionaryAlphabeticalBrowse = (
  publication: CanonicalDictionaryPublication
) => {
  const entryCountByInitial: Record<string, number> = {}
  for (const entry of publication.entries) {
    const initial = [...entry.normalizedWord][0] ?? '#'
    entryCountByInitial[initial] = (entryCountByInitial[initial] ?? 0) + 1
  }
  const initials = Object.keys(entryCountByInitial).sort((left, right) => left.localeCompare(right))
  return {
    initials,
    entryCountByInitial: Object.fromEntries(
      initials.map(initial => [initial, entryCountByInitial[initial] ?? 0])
    ),
  }
}

export const countCanonicalStrongBibleContent = (publication: CanonicalStrongBiblePublication) => ({
  verses: publication.verses.length,
  occurrences: publication.spans.length,
  unalignedOccurrences: publication.spans.filter(span => !span.isAligned).length,
  identities: publication.spanIdentities.length,
  lexemeAssignments: publication.spans.filter(span => span.lexemeId !== undefined).length,
  lexemes: publication.lexemes.length,
})

export const countCanonicalInterlinearBibleContent = (
  publication: CanonicalInterlinearBiblePublication
) => ({
  verses: publication.verses.length,
  tokens: publication.tokens.length,
  segments: publication.segments.length,
  identities: publication.segmentIdentities.length,
})

export const deriveStrongBibleResourceRevision = (
  publication: CanonicalStrongBiblePublication
): string => {
  const digest = createHash('sha256')
    .update(JSON.stringify(normalizeJson(publication)))
    .digest('hex')
  return `${publication.applicationVersionId.toLowerCase()}-strong-${digest.slice(0, 20)}`
}

export const deriveInterlinearBibleResourceRevision = (
  publication:
    | CanonicalInterlinearBiblePublication
    | Omit<CanonicalInterlinearBiblePublication, 'indexRevision'>
): string => {
  const { indexRevision: _indexRevision, ...content } =
    publication as CanonicalInterlinearBiblePublication
  const digest = createHash('sha256')
    .update(JSON.stringify(normalizeJson(content)))
    .digest('hex')
  return `bhg-interlinear-${publication.language}-${digest.slice(0, 20)}`
}

export const deriveTimelineResourceRevision = (
  publication: Pick<CanonicalTimelinePublication, 'language' | 'events'>
): string => {
  const digest = createHash('sha256')
    .update(JSON.stringify(normalizeJson(publication.events)))
    .digest('hex')
  return `timeline-${publication.language}-${digest.slice(0, 20)}`
}

export const countCanonicalTimelineContent = (publication: CanonicalTimelinePublication) => ({
  events: publication.events.length,
  relations: publication.events.reduce((total, event) => total + event.related.length, 0),
  scriptures: publication.events.reduce((total, event) => total + event.scriptures.length, 0),
})

export const getCanonicalNaveAlphabeticalBrowse = (publication: CanonicalNavePublication) => {
  const topicCountByInitial: Record<string, number> = {}
  for (const topic of publication.topics) {
    topicCountByInitial[topic.initial] = (topicCountByInitial[topic.initial] ?? 0) + 1
  }
  return {
    initials: Object.keys(topicCountByInitial).sort(),
    topicCountByInitial: Object.fromEntries(
      Object.entries(topicCountByInitial).sort(([left], [right]) => left.localeCompare(right))
    ),
  }
}

const readSqliteRows = (database: Database, query: string) => {
  const statement = database.prepare(query)
  const rows: Record<string, unknown>[] = []
  try {
    while (statement.step()) rows.push(statement.getAsObject())
    return rows
  } finally {
    statement.free()
  }
}

const assertSqliteQueryIndexes = (
  database: Database,
  requirements: Record<string, readonly string[]>
) => {
  for (const [tableName, requiredColumns] of Object.entries(requirements)) {
    const indexes = readSqliteRows(
      database,
      `PRAGMA index_list("${tableName.replaceAll('"', '""')}")`
    )
    const hasPrefix = indexes.some(index => {
      const indexName = requireSqliteString(index.name)
      const columns = readSqliteRows(
        database,
        `PRAGMA index_info("${indexName.replaceAll('"', '""')}")`
      ).map(column => requireSqliteString(column.name))
      return requiredColumns.every((column, position) => columns[position] === column)
    })
    if (!hasPrefix) {
      throw new Error(`OFFLINE_ARTIFACT_INDEX_MISSING:${tableName}(${requiredColumns.join(',')})`)
    }
  }
}

const requireSqliteString = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
  return value
}

const compareIdentity = (left: { normalizedName: string }, right: { normalizedName: string }) =>
  left.normalizedName.localeCompare(right.normalizedName)

const compareVerseKey = (left: { verseKey: string }, right: { verseKey: string }) =>
  left.verseKey.localeCompare(right.verseKey)

const validateNaveOfflineParity = async (
  offlineContent: Uint8Array,
  canonical: CanonicalNavePublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(offlineContent)
    const integrity = readSqliteRows(database, 'PRAGMA integrity_check')
    if (integrity.length !== 1 || Object.values(integrity[0] ?? {}).some(value => value !== 'ok')) {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    const metadataRows = readSqliteRows(
      database,
      'SELECT resource_id, revision, source_version, source_sha256 FROM RESOURCE_METADATA'
    )
    if (metadataRows.length !== 1) throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
    const metadata = metadataRows[0]
    if (
      requireSqliteString(metadata?.resource_id) !== canonical.resourceId ||
      requireSqliteString(metadata?.revision) !== canonical.revision ||
      requireSqliteString(metadata?.source_version) !== canonical.sourceVersion ||
      requireSqliteString(metadata?.source_sha256) !== canonical.sourceSha256
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }

    const topics = readSqliteRows(
      database,
      'SELECT name_lower, name, letter, description FROM TOPICS'
    )
      .map(row => ({
        normalizedName: requireSqliteString(row.name_lower),
        name: requireSqliteString(row.name),
        initial: requireSqliteString(row.letter),
        description: requireSqliteString(row.description),
      }))
      .sort(compareIdentity)
    const verseAnchors = readSqliteRows(database, 'SELECT id, ref FROM VERSES')
      .map(row => {
        const verseKey = requireSqliteString(row.id)
        const encodedReferences = requireSqliteString(row.ref)
        let topicNormalizedNames: unknown
        try {
          topicNormalizedNames = JSON.parse(encodedReferences)
        } catch (cause) {
          throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
        }
        if (
          !Array.isArray(topicNormalizedNames) ||
          topicNormalizedNames.some(reference => typeof reference !== 'string')
        ) {
          throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
        }
        return { verseKey, topicNormalizedNames: [...topicNormalizedNames].sort() }
      })
      .sort(compareVerseKey)
    const expectedTopics = [...canonical.topics].sort(compareIdentity)
    const expectedVerseAnchors = canonical.verseAnchors
      .map(anchor => ({
        verseKey: anchor.verseKey,
        topicNormalizedNames: [...anchor.topicNormalizedNames].sort(),
      }))
      .sort(compareVerseKey)

    if (
      JSON.stringify(topics) !== JSON.stringify(expectedTopics) ||
      JSON.stringify(verseAnchors) !== JSON.stringify(expectedVerseAnchors)
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

const validateDictionaryOfflineParity = async (
  offlineContent: Uint8Array,
  canonical: CanonicalDictionaryPublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(offlineContent)
    const integrity = readSqliteRows(database, 'PRAGMA integrity_check')
    if (integrity.length !== 1 || Object.values(integrity[0] ?? {}).some(value => value !== 'ok')) {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    const tables = readSqliteRows(
      database,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).map(row => requireSqliteString(row.name))
    const tableNames = new Set(tables)
    if (
      !['RESOURCE_METADATA', 'dictionnaire', 'verses'].every(table => tableNames.has(table)) ||
      (canonical.passageAnchors !== undefined && !tableNames.has('dictionary_passage_anchors')) ||
      (canonical.entries.some(entry => entry.correspondenceId !== undefined) &&
        !tableNames.has('dictionary_correspondences'))
    ) {
      throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
    }
    const metadataRows = readSqliteRows(
      database,
      'SELECT resource_id, work, language, revision, source_version, source_sha256 FROM RESOURCE_METADATA'
    )
    const metadata = metadataRows[0]
    if (
      metadataRows.length !== 1 ||
      requireSqliteString(metadata?.resource_id) !==
        `dictionary:${canonical.work}:${canonical.language}` ||
      requireSqliteString(metadata?.work) !== canonical.work ||
      requireSqliteString(metadata?.language) !== canonical.language ||
      requireSqliteString(metadata?.revision) !== canonical.revision ||
      requireSqliteString(metadata?.source_version) !== canonical.sourceVersion ||
      requireSqliteString(metadata?.source_sha256) !== canonical.sourceSha256
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
    const entries = readSqliteRows(
      database,
      tableNames.has('dictionary_correspondences')
        ? `SELECT entry.id, entry.sanitized_word, entry.word, entry.definition,
                  correspondence.correspondence_id
           FROM dictionnaire entry
           LEFT JOIN dictionary_correspondences correspondence ON correspondence.entry_id = entry.id
           ORDER BY entry.id`
        : 'SELECT id, sanitized_word, word, definition, NULL AS correspondence_id FROM dictionnaire ORDER BY id'
    ).map(row => {
      const id = requireSqliteInteger(row.id)
      const normalizedWord = requireSqliteString(row.sanitized_word).trim().toLocaleLowerCase()
      const word = requireSqliteString(row.word)
      const definition = requireSqliteString(row.definition)
      if (id <= 0 || !normalizedWord || !word) throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
      const correspondenceId =
        typeof row.correspondence_id === 'string' && row.correspondence_id.length > 0
          ? row.correspondence_id
          : undefined
      return {
        id,
        word,
        normalizedWord,
        definition,
        ...(correspondenceId ? { correspondenceId } : {}),
      }
    })
    const verseAnchors = readSqliteRows(database, 'SELECT id, ref FROM verses ORDER BY id').map(
      row => {
        const verseKey = requireSqliteString(row.id)
        if (!isDictionaryVerseKey(verseKey)) throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
        let words: unknown
        try {
          words = JSON.parse(requireSqliteString(row.ref))
        } catch (cause) {
          throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
        }
        if (!Array.isArray(words) || words.some(word => typeof word !== 'string' || !word.trim())) {
          throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
        }
        return { verseKey, words: [...new Set(words.map(word => word.trim().toLocaleLowerCase()))] }
      }
    )
    const passageAnchors = canonical.passageAnchors
      ? (() => {
          const rows = readSqliteRows(
            database,
            `SELECT verse_key, entry_id, evidence_kind
             FROM dictionary_passage_anchors
             ORDER BY verse_key, ordinal, entry_id`
          )
          const byVerse = new Map<
            string,
            Array<{
              entryId: number
              evidenceKind: 'source-citation' | 'verse-name' | 'verse-phrase'
            }>
          >()
          for (const row of rows) {
            const verseKey = requireSqliteString(row.verse_key)
            const entryId = requireSqliteInteger(row.entry_id)
            const evidenceKind = requireSqliteString(row.evidence_kind)
            if (
              !isDictionaryVerseKey(verseKey) ||
              !['source-citation', 'verse-name', 'verse-phrase'].includes(evidenceKind) ||
              !canonical.entries.some(entry => entry.id === entryId)
            ) {
              throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
            }
            const anchors = byVerse.get(verseKey) ?? []
            anchors.push({
              entryId,
              evidenceKind: evidenceKind as 'source-citation' | 'verse-name' | 'verse-phrase',
            })
            byVerse.set(verseKey, anchors)
          }
          return [...byVerse].map(([verseKey, passageEntries]) => ({
            verseKey,
            entries: passageEntries,
          }))
        })()
      : undefined
    if (
      JSON.stringify(entries) !== JSON.stringify(canonical.entries) ||
      JSON.stringify(verseAnchors) !== JSON.stringify(canonical.verseAnchors) ||
      (canonical.passageAnchors !== undefined &&
        JSON.stringify(passageAnchors) !== JSON.stringify(canonical.passageAnchors))
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

const validateDictionaryDirectoryOfflineParity = async (
  offlineContent: Uint8Array,
  canonical: CanonicalDictionaryDirectoryPublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(offlineContent)
    const integrity = readSqliteRows(database, 'PRAGMA integrity_check')
    if (integrity.length !== 1 || Object.values(integrity[0] ?? {}).some(value => value !== 'ok')) {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    const tables = new Set(
      readSqliteRows(
        database,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).map(row => requireSqliteString(row.name))
    )
    if (
      ![
        'RESOURCE_METADATA',
        'dictionary_works',
        'dictionary_entries',
        'dictionary_correspondences',
        'dictionary_correspondence_members',
        'dictionary_passage_anchors',
      ].every(table => tables.has(table))
    ) {
      throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
    }
    const metadataRows = readSqliteRows(
      database,
      `SELECT revision, works_count, entries_count, correspondences_count,
              passage_anchors_count FROM RESOURCE_METADATA`
    )
    const metadata = metadataRows[0]
    if (
      metadataRows.length !== 1 ||
      requireSqliteString(metadata?.revision) !== canonical.revision ||
      requireSqliteInteger(metadata?.works_count) !== canonical.counts.works ||
      requireSqliteInteger(metadata?.entries_count) !== canonical.counts.entries ||
      requireSqliteInteger(metadata?.correspondences_count) !== canonical.counts.correspondences ||
      requireSqliteInteger(metadata?.passage_anchors_count) !== canonical.counts.passageAnchors
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

const validateCommentaryOfflineParity = async (
  offlineContent: Uint8Array,
  canonical: CanonicalCommentaryPublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(offlineContent)
    const integrity = readSqliteRows(database, 'PRAGMA integrity_check')
    if (integrity.length !== 1 || Object.values(integrity[0] ?? {}).some(value => value !== 'ok')) {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    const metadataRows = readSqliteRows(
      database,
      'SELECT resource_id, language, revision, source_version, source_sha256 FROM RESOURCE_METADATA'
    )
    const metadata = metadataRows[0]
    if (
      metadataRows.length !== 1 ||
      requireSqliteString(metadata?.resource_id) !== canonical.resourceId ||
      requireSqliteString(metadata?.language) !== canonical.language ||
      requireSqliteString(metadata?.revision) !== canonical.revision ||
      requireSqliteString(metadata?.source_version) !== canonical.sourceVersion ||
      requireSqliteString(metadata?.source_sha256) !== canonical.sourceSha256
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
    if (canonical.schemaVersion === 2) {
      const documentRows = readSqliteRows(database, 'SELECT id, content FROM COMMENTARY_DOCUMENTS')
      if (documentRows.length !== canonical.documents.length) {
        throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
      }
      const offlineDocuments = new Map(
        documentRows.map(row => [requireSqliteString(row.id), requireSqliteString(row.content)])
      )
      if (
        canonical.documents.some(document => offlineDocuments.get(document.id) !== document.content)
      ) {
        throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
      }
      const associationRows = readSqliteRows(
        database,
        `SELECT verse_key, ordinal, document_id
           FROM COMMENTARY_VERSE_DOCUMENTS
          ORDER BY verse_key, ordinal`
      )
      const offlineAssociations = new Map<string, string[]>()
      for (const row of associationRows) {
        const verseKey = requireSqliteString(row.verse_key)
        const values = offlineAssociations.get(verseKey) ?? []
        values.push(requireSqliteString(row.document_id))
        offlineAssociations.set(verseKey, values)
      }
      if (
        offlineAssociations.size !== canonical.verses.length ||
        canonical.verses.some(
          verse =>
            JSON.stringify(offlineAssociations.get(verse.verseKey)) !==
            JSON.stringify(verse.documentIds)
        )
      ) {
        throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
      }
      return
    }
    const verses = readSqliteRows(database, 'SELECT id, commentaires FROM COMMENTAIRES')
      .flatMap(row => {
        const chapterKey = requireSqliteString(row.id)
        let content: unknown
        try {
          content = JSON.parse(requireSqliteString(row.commentaires))
        } catch (cause) {
          throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
        }
        if (!content || typeof content !== 'object' || Array.isArray(content)) {
          throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
        }
        return Object.entries(content).flatMap(([verse, value]) =>
          typeof value === 'string' && value.trim()
            ? [{ verseKey: `${chapterKey}-${verse}`, content: value }]
            : []
        )
      })
      .sort(compareVerseKey)
    const canonicalVerses = [...canonical.verses].sort(compareVerseKey)
    if (verses.length !== canonicalVerses.length) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
    for (const [index, verse] of verses.entries()) {
      const canonicalVerse = canonicalVerses[index]!
      if (verse.verseKey !== canonicalVerse.verseKey || verse.content !== canonicalVerse.content) {
        throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
      }
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

const validateCrossReferenceOfflineParity = async (
  offlineContent: Uint8Array,
  canonical: CanonicalCrossReferencePublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(offlineContent)
    const integrity = readSqliteRows(database, 'PRAGMA integrity_check')
    if (integrity.length !== 1 || Object.values(integrity[0] ?? {}).some(value => value !== 'ok')) {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    const metadataRows = readSqliteRows(
      database,
      'SELECT resource_id, language, revision, source_version, source_sha256 FROM RESOURCE_METADATA'
    )
    const metadata = metadataRows[0]
    if (
      metadataRows.length !== 1 ||
      requireSqliteString(metadata?.resource_id) !== canonical.resourceId ||
      requireSqliteString(metadata?.language) !== canonical.language ||
      requireSqliteString(metadata?.revision) !== canonical.revision ||
      requireSqliteString(metadata?.source_version) !== canonical.sourceVersion ||
      requireSqliteString(metadata?.source_sha256) !== canonical.sourceSha256
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
    const anchors = readSqliteRows(database, 'SELECT id, commentaires FROM COMMENTAIRES')
      .flatMap(row => {
        const verseKey = requireSqliteString(row.id)
        let references: unknown
        try {
          references = JSON.parse(requireSqliteString(row.commentaires))
        } catch (cause) {
          throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
        }
        if (!Array.isArray(references)) throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
        const values = references
          .filter((reference): reference is string => typeof reference === 'string')
          .map(reference => reference.trim())
          .filter(Boolean)
        return values.length > 0 ? [{ verseKey, references: values }] : []
      })
      .sort(compareVerseKey)
    if (
      JSON.stringify(anchors) !== JSON.stringify([...canonical.verseAnchors].sort(compareVerseKey))
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

const requireSqliteInteger = (value: unknown) => {
  if (!Number.isSafeInteger(value)) throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
  return Number(value)
}

const compareStrongLocation = (
  left: CanonicalStrongBibleVerse & { ordinal?: number; identityOrder?: number },
  right: CanonicalStrongBibleVerse & { ordinal?: number; identityOrder?: number }
) =>
  left.book - right.book ||
  left.chapter - right.chapter ||
  left.verse - right.verse ||
  (left.ordinal ?? -1) - (right.ordinal ?? -1) ||
  (left.identityOrder ?? -1) - (right.identityOrder ?? -1)

const validateStrongBibleOfflineParity = async (
  offlineContent: Uint8Array,
  canonical: CanonicalStrongBiblePublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(offlineContent)
    const integrity = readSqliteRows(database, 'PRAGMA integrity_check')
    const foreignKeyFailures = readSqliteRows(database, 'PRAGMA foreign_key_check')
    if (
      integrity.length !== 1 ||
      Object.values(integrity[0] ?? {}).some(value => value !== 'ok') ||
      foreignKeyFailures.length !== 0
    ) {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    assertSqliteQueryIndexes(database, {
      Verses: ['bookOrder', 'chapter', 'verse'],
      StrongCodes: ['kind', 'code'],
      WordStrongCodes: ['codeId', 'verseId', 'ordinal'],
    })
    const metadata = Object.fromEntries(
      readSqliteRows(database, 'SELECT key, value FROM ResourceMetadata').map(row => [
        requireSqliteString(row.key),
        requireSqliteString(row.value),
      ])
    )
    if (
      metadata.applicationVersionId !== canonical.applicationVersionId ||
      metadata.datasetId !== canonical.datasetId ||
      metadata.textRevision !== canonical.textRevision ||
      metadata.textSha256 !== canonical.textSha256 ||
      metadata.strongRevision !== canonical.strongRevision
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }

    const verses = readSqliteRows(
      database,
      'SELECT bookOrder AS book, chapter, verse FROM Verses ORDER BY bookOrder, chapter, verse'
    ).map(row => ({
      book: requireSqliteInteger(row.book),
      chapter: requireSqliteInteger(row.chapter),
      verse: requireSqliteInteger(row.verse),
    }))
    const lexemes = readSqliteRows(
      database,
      'SELECT id, lemma, partOfSpeech FROM FrenchLexemes ORDER BY id'
    ).map(row => ({
      id: requireSqliteInteger(row.id),
      lemma: requireSqliteString(row.lemma),
      partOfSpeech: requireSqliteString(row.partOfSpeech),
    }))
    const identities = readSqliteRows(
      database,
      'SELECT id, kind, code FROM StrongCodes ORDER BY id'
    ).map(row => {
      const kind = STRONG_IDENTITY_KINDS[requireSqliteInteger(row.kind)]
      if (!kind) throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
      return {
        id: requireSqliteInteger(row.id),
        kind,
        code: requireSqliteString(row.code),
      }
    })
    const wordSpanColumns = new Set(
      readSqliteRows(database, 'PRAGMA table_info(WordSpans)').map(row =>
        requireSqliteString(row.name)
      )
    )
    const extrasTable = readSqliteRows(
      database,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='WordStepTokenExtras'"
    )
    const extrasBySpan = new Map<string, number[]>()
    if (extrasTable.length > 0) {
      for (const row of readSqliteRows(
        database,
        `SELECT verseId, targetOrdinal, stepTokenId
         FROM WordStepTokenExtras ORDER BY verseId, targetOrdinal, sourceOrder`
      )) {
        const key = `${requireSqliteInteger(row.verseId)}-${requireSqliteInteger(
          row.targetOrdinal
        )}`
        const stepTokenIds = extrasBySpan.get(key) ?? []
        stepTokenIds.push(requireSqliteInteger(row.stepTokenId))
        extrasBySpan.set(key, stepTokenIds)
      }
    }
    const spans = readSqliteRows(
      database,
      `SELECT v.id AS verseId, v.bookOrder AS book, v.chapter, v.verse,
              s.ordinal, s.startOffset, s.length, s.isAligned, s.lexemeId${
                wordSpanColumns.has('stepTokenId') ? ', s.stepTokenId' : ''
              }
         FROM WordSpans s JOIN Verses v ON v.id=s.verseId
        ORDER BY v.bookOrder, v.chapter, v.verse, s.ordinal`
    ).map(row => {
      const verseId = requireSqliteInteger(row.verseId)
      const ordinal = requireSqliteInteger(row.ordinal)
      const primaryStepTokenId = wordSpanColumns.has('stepTokenId')
        ? row.stepTokenId == null
          ? undefined
          : requireSqliteInteger(row.stepTokenId)
        : undefined
      const stepTokenIds = [
        ...(primaryStepTokenId === undefined ? [] : [primaryStepTokenId]),
        ...(extrasBySpan.get(`${verseId}-${ordinal}`) ?? []),
      ]
      return {
        book: requireSqliteInteger(row.book),
        chapter: requireSqliteInteger(row.chapter),
        verse: requireSqliteInteger(row.verse),
        ordinal,
        startOffset: requireSqliteInteger(row.startOffset),
        length: requireSqliteInteger(row.length),
        isAligned: requireSqliteInteger(row.isAligned) === 1,
        ...(row.lexemeId == null ? {} : { lexemeId: requireSqliteInteger(row.lexemeId) }),
        ...(stepTokenIds.length ? { stepTokenIds } : {}),
      }
    })
    const spanIdentities = readSqliteRows(
      database,
      `SELECT v.bookOrder AS book, v.chapter, v.verse, w.ordinal,
              w.identityOrder, w.codeId AS identityId
         FROM WordStrongCodes w JOIN Verses v ON v.id=w.verseId
        ORDER BY v.bookOrder, v.chapter, v.verse, w.ordinal, w.identityOrder`
    ).map(row => ({
      book: requireSqliteInteger(row.book),
      chapter: requireSqliteInteger(row.chapter),
      verse: requireSqliteInteger(row.verse),
      ordinal: requireSqliteInteger(row.ordinal),
      identityOrder: requireSqliteInteger(row.identityOrder),
      identityId: requireSqliteInteger(row.identityId),
    }))

    const expected = {
      verses: [...canonical.verses].sort(compareStrongLocation),
      lexemes: [...canonical.lexemes].sort((left, right) => left.id - right.id),
      identities: [...canonical.identities].sort((left, right) => left.id - right.id),
      spans: [...canonical.spans].sort(compareStrongLocation),
      spanIdentities: [...canonical.spanIdentities].sort(compareStrongLocation),
    }
    if (
      JSON.stringify({ verses, lexemes, identities, spans, spanIdentities }) !==
      JSON.stringify(expected)
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

const validateInterlinearBibleOfflineParity = async (
  offlineContent: Uint8Array,
  canonical: CanonicalInterlinearBiblePublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(offlineContent)
    const integrity = readSqliteRows(database, 'PRAGMA integrity_check')
    const foreignKeyFailures = readSqliteRows(database, 'PRAGMA foreign_key_check')
    if (
      integrity.length !== 1 ||
      Object.values(integrity[0] ?? {}).some(value => value !== 'ok') ||
      foreignKeyFailures.length !== 0
    ) {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    assertSqliteQueryIndexes(database, {
      Verses: ['bookOrder', 'chapter', 'verse'],
      StrongCodes: ['code'],
      StrongVerseIndex: ['codeId', 'verseId'],
    })
    const metadata = Object.fromEntries(
      readSqliteRows(database, 'SELECT key, value FROM ResourceMetadata').map(row => [
        requireSqliteString(row.key),
        requireSqliteString(row.value),
      ])
    )
    if (
      metadata.schemaVersion !== '5' ||
      metadata.applicationVersionId !== canonical.applicationVersionId ||
      metadata.datasetId !== canonical.datasetId ||
      metadata.locale !== canonical.language ||
      metadata.textRevision !== canonical.textRevision ||
      metadata.textSha256 !== canonical.textSha256 ||
      metadata.indexRevision !== canonical.indexRevision
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }

    const verses = readSqliteRows(
      database,
      'SELECT id, bookOrder AS book, chapter, verse FROM Verses ORDER BY id'
    ).map(row => ({
      id: requireSqliteInteger(row.id),
      book: requireSqliteInteger(row.book),
      chapter: requireSqliteInteger(row.chapter),
      verse: requireSqliteInteger(row.verse),
    }))
    const tokens = readSqliteRows(
      database,
      `SELECT id, verseId, readingOrdinal AS ordinal, startOffset, length
         FROM Tokens ORDER BY id`
    ).map(row => ({
      id: requireSqliteInteger(row.id),
      verseId: requireSqliteInteger(row.verseId),
      ordinal: requireSqliteInteger(row.ordinal),
      startOffset: requireSqliteInteger(row.startOffset),
      length: requireSqliteInteger(row.length),
    }))
    const segments = readSqliteRows(
      database,
      `SELECT s.id, s.tokenId, s.ordinal, s.startOffset, s.length,
              tr.value AS transliteration, l.value AS lemma,
              m.code AS morphology, g.text AS gloss
         FROM Segments s
         JOIN Transliterations tr ON tr.id=s.transliterationId
         JOIN Lemmas l ON l.id=s.lemmaId
         JOIN Morphologies m ON m.id=s.morphologyId
         JOIN Glosses g ON g.id=s.glossId
        ORDER BY s.id`
    ).map(row => ({
      id: requireSqliteInteger(row.id),
      tokenId: requireSqliteInteger(row.tokenId),
      ordinal: requireSqliteInteger(row.ordinal),
      startOffset: requireSqliteInteger(row.startOffset),
      length: requireSqliteInteger(row.length),
      transliteration: requireSqliteString(row.transliteration),
      lemma: requireSqliteString(row.lemma),
      morphology: requireSqliteString(row.morphology),
      gloss: requireSqliteString(row.gloss),
    }))
    const segmentIdentities = readSqliteRows(
      database,
      `SELECT s.id AS segmentId,
              c0.code AS strong, c1.code AS estrong,
              c2.code AS dstrong, c3.code AS ustrong
         FROM Segments s
         LEFT JOIN StrongCodes c0 ON c0.id=s.strongCodeId
         LEFT JOIN StrongCodes c1 ON c1.id=s.eStrongCodeId
         LEFT JOIN StrongCodes c2 ON c2.id=s.dStrongCodeId
         LEFT JOIN StrongCodes c3 ON c3.id=s.uStrongCodeId
        ORDER BY s.id`
    ).flatMap(row =>
      STRONG_IDENTITY_KINDS.flatMap((kind, identityOrder) => {
        const code = row[kind]
        return code == null
          ? []
          : [
              {
                segmentId: requireSqliteInteger(row.segmentId),
                identityOrder,
                kind,
                code: requireSqliteString(code),
              },
            ]
      })
    )

    const rawCounts = {
      verses: requireSqliteInteger(
        readSqliteRows(database, 'SELECT COUNT(*) AS count FROM Verses')[0]?.count
      ),
      tokens: requireSqliteInteger(
        readSqliteRows(database, 'SELECT COUNT(*) AS count FROM Tokens')[0]?.count
      ),
      segments: requireSqliteInteger(
        readSqliteRows(database, 'SELECT COUNT(*) AS count FROM Segments')[0]?.count
      ),
      identities: segmentIdentities.length,
    }
    if (
      rawCounts.verses !== canonical.verses.length ||
      rawCounts.tokens !== canonical.tokens.length ||
      rawCounts.segments !== canonical.segments.length ||
      rawCounts.identities !== canonical.segmentIdentities.length ||
      verses.length !== rawCounts.verses ||
      tokens.length !== rawCounts.tokens ||
      segments.length !== rawCounts.segments
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }

    const verseByToken = new Map(canonical.tokens.map(token => [token.id, token.verseId]))
    const tokenBySegment = new Map(canonical.segments.map(segment => [segment.id, segment.tokenId]))
    const expectedStrongVerseIndex = new Map<string, number>()
    for (const identity of canonical.segmentIdentities) {
      const verseId = verseByToken.get(tokenBySegment.get(identity.segmentId) ?? -1)
      if (verseId === undefined) throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
      const key = `${verseId}:${identity.code}`
      expectedStrongVerseIndex.set(
        key,
        (expectedStrongVerseIndex.get(key) ?? 0) | (1 << identity.identityOrder)
      )
    }
    const strongVerseRows = readSqliteRows(
      database,
      `SELECT svi.verseId AS verseId, sc.code AS code, svi.kindMask AS kindMask
         FROM StrongVerseIndex svi
         JOIN StrongCodes sc ON sc.id=svi.codeId
        ORDER BY svi.verseId, sc.code`
    )
    const actualStrongVerseIndex = new Map(
      strongVerseRows.map(row => [
        `${requireSqliteInteger(row.verseId)}:${requireSqliteString(row.code)}`,
        requireSqliteInteger(row.kindMask),
      ])
    )
    if (
      actualStrongVerseIndex.size !== strongVerseRows.length ||
      actualStrongVerseIndex.size !== expectedStrongVerseIndex.size ||
      [...expectedStrongVerseIndex].some(
        ([key, kindMask]) => actualStrongVerseIndex.get(key) !== kindMask
      )
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }

    const expected = {
      verses: [...canonical.verses].sort((left, right) => left.id - right.id),
      tokens: [...canonical.tokens].sort((left, right) => left.id - right.id),
      segments: [...canonical.segments].sort((left, right) => left.id - right.id),
      segmentIdentities: [...canonical.segmentIdentities].sort(
        (left, right) =>
          left.segmentId - right.segmentId || left.identityOrder - right.identityOrder
      ),
    }
    if (
      JSON.stringify({ verses, tokens, segments, segmentIdentities }) !== JSON.stringify(expected)
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

const STRONG_LEXICON_TABLES = {
  core: [
    'StepEntries',
    'StepEntryIdentities',
    'LexiconTranslations',
    'RelationKinds',
    'LexiconRelations',
    'MorphologyCodes',
    'MorphologyCodeTranslations',
  ],
  resources: ['LexiconResources', 'LexiconResourceTranslations'],
  entities: ['Entities', 'EntityTranslations', 'EntityRefs', 'EntityRelations', 'EntityPlaces'],
} as const

const strongLexiconTables = (
  moduleId: CanonicalStrongLexiconModulePublication['moduleId'],
  schemaVersion: CanonicalStrongLexiconModulePublication['schemaVersion']
): readonly string[] =>
  moduleId === 'core' && schemaVersion >= 2
    ? [...STRONG_LEXICON_TABLES.core, 'LexiconNameMeanings']
    : STRONG_LEXICON_TABLES[moduleId]

const STRONG_LEXICON_TABLE_COLUMNS: Record<
  keyof typeof STRONG_LEXICON_TABLES,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: [
      'id',
      'language',
      'baseCode',
      'eStrong',
      'dStrong',
      'uStrong',
      'original',
      'transliteration',
      'morph',
      'gloss',
      'meaning',
      'classicTransliteration',
      'pronunciation',
    ],
    StepEntryIdentities: ['stepEntryId', 'stepCode'],
    LexiconTranslations: ['stepEntryId', 'language', 'gloss', 'meaning', 'meaningHtml'],
    LexiconNameMeanings: [
      'stepEntryId',
      'language',
      'valueHtml',
      'valueText',
      'source',
      'sourceField',
      'sourceTextSha256',
      'translationEngine',
    ],
    RelationKinds: ['id', 'kind', 'labelEn', 'labelFr'],
    LexiconRelations: [
      'id',
      'fromStepEntryId',
      'toStepEntryId',
      'toStepCode',
      'groupKind',
      'relationKindId',
      'sortOrder',
    ],
    MorphologyCodes: [
      'id',
      'code',
      'normalizedCode',
      'language',
      'scope',
      'meaning',
      'description',
    ],
    MorphologyCodeTranslations: ['morphologyCodeId', 'language', 'meaning', 'description'],
  },
  resources: {
    LexiconResources: ['id', 'stepEntryId', 'source', 'kind', 'contentHtml'],
    LexiconResourceTranslations: ['resourceId', 'language', 'contentHtml'],
  },
  entities: {
    Entities: [
      'id',
      'uniqueName',
      'uStrong',
      'displayName',
      'category',
      'type',
      'description',
      'summaryHtml',
      'briefest',
      'brief',
      'shortDescription',
      'articleHtml',
    ],
    EntityTranslations: [
      'id',
      'entityId',
      'language',
      'displayName',
      'description',
      'summaryHtml',
      'briefest',
      'brief',
      'shortDescription',
      'articleHtml',
    ],
    EntityRefs: ['entityId', 'book', 'chapter', 'verse', 'suffix', 'refText'],
    EntityRelations: ['fromEntityId', 'relation', 'toUniqueName', 'toEntityId', 'certainty'],
    EntityPlaces: [
      'entityId',
      'openBibleName',
      'googleMapUrl',
      'palopenmapsUrl',
      'latitude',
      'longitude',
      'area',
    ],
  },
}

const STRONG_LEXICON_TABLE_PRIMARY_KEYS: Record<
  keyof typeof STRONG_LEXICON_TABLES,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: ['id'],
    StepEntryIdentities: ['stepEntryId'],
    LexiconTranslations: ['stepEntryId', 'language'],
    LexiconNameMeanings: ['stepEntryId', 'language'],
    RelationKinds: ['id'],
    LexiconRelations: ['id'],
    MorphologyCodes: ['id'],
    MorphologyCodeTranslations: ['morphologyCodeId', 'language'],
  },
  resources: {
    LexiconResources: ['id'],
    LexiconResourceTranslations: ['resourceId', 'language'],
  },
  entities: {
    Entities: ['id'],
    EntityTranslations: ['id'],
    EntityRefs: ['entityId', 'book', 'chapter', 'verse', 'suffix'],
    EntityRelations: [],
    EntityPlaces: ['entityId'],
  },
}

const STRONG_LEXICON_TABLE_UNIQUE_KEYS: Record<
  keyof typeof STRONG_LEXICON_TABLES,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntryIdentities: ['stepCode'],
    RelationKinds: ['kind'],
  },
  resources: {},
  entities: {
    Entities: ['uniqueName'],
    EntityRelations: ['fromEntityId', 'relation', 'toUniqueName', 'toEntityId'],
  },
}

const STRONG_LEXICON_REQUIRED_COLUMNS: Record<
  keyof typeof STRONG_LEXICON_TABLES,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: ['language', 'eStrong', 'dStrong', 'uStrong', 'gloss'],
    StepEntryIdentities: ['stepCode'],
    LexiconTranslations: ['language'],
    LexiconNameMeanings: [
      'language',
      'valueHtml',
      'valueText',
      'source',
      'sourceField',
      'sourceTextSha256',
      'translationEngine',
    ],
    RelationKinds: ['kind'],
    LexiconRelations: ['toStepCode', 'groupKind'],
    MorphologyCodes: ['code', 'normalizedCode', 'language', 'scope'],
    MorphologyCodeTranslations: ['language'],
  },
  resources: {
    LexiconResources: ['source', 'kind'],
    LexiconResourceTranslations: ['language'],
  },
  entities: {
    Entities: ['uniqueName', 'uStrong', 'displayName', 'category', 'type'],
    EntityTranslations: ['language'],
    EntityRefs: ['book', 'refText'],
    EntityRelations: ['relation', 'toUniqueName', 'certainty'],
    EntityPlaces: [],
  },
}

const STRONG_LEXICON_POSITIVE_INTEGER_COLUMNS = new Set([
  'id',
  'baseCode',
  'stepEntryId',
  'resourceId',
  'morphologyCodeId',
  'entityId',
  'fromStepEntryId',
  'toStepEntryId',
  'fromEntityId',
  'toEntityId',
  'relationKindId',
  'sortOrder',
  'chapter',
  'verse',
])

const STRONG_LEXICON_REQUIRED_INTEGER_COLUMNS: Record<
  keyof typeof STRONG_LEXICON_TABLES,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: ['id', 'baseCode'],
    StepEntryIdentities: ['stepEntryId'],
    LexiconTranslations: ['stepEntryId'],
    LexiconNameMeanings: ['stepEntryId'],
    RelationKinds: ['id'],
    LexiconRelations: ['id', 'fromStepEntryId', 'relationKindId'],
    MorphologyCodes: ['id'],
    MorphologyCodeTranslations: ['morphologyCodeId'],
  },
  resources: {
    LexiconResources: ['id', 'stepEntryId'],
    LexiconResourceTranslations: ['resourceId'],
  },
  entities: {
    Entities: ['id'],
    EntityTranslations: ['id', 'entityId'],
    EntityRefs: ['entityId', 'chapter', 'verse'],
    EntityRelations: ['fromEntityId'],
    EntityPlaces: ['entityId'],
  },
}

const STRONG_LEXICON_SQLITE_INTEGER_COLUMNS = new Set([
  'id',
  'baseCode',
  'stepEntryId',
  'resourceId',
  'morphologyCodeId',
  'entityId',
  'fromStepEntryId',
  'toStepEntryId',
  'fromEntityId',
  'toEntityId',
  'relationKindId',
  'sortOrder',
  'chapter',
  'verse',
])
const STRONG_LEXICON_SQLITE_REAL_COLUMNS = new Set(['latitude', 'longitude'])
const STRONG_LEXICON_SQLITE_OPTIONAL_COLUMNS = new Set([
  'toStepEntryId',
  'toEntityId',
  'latitude',
  'longitude',
])
const STRONG_LEXICON_SQLITE_UNIQUE_COLUMNS: Record<
  keyof typeof STRONG_LEXICON_TABLES,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntryIdentities: ['stepCode'],
    RelationKinds: ['kind'],
  },
  resources: {},
  entities: { Entities: ['uniqueName'] },
}

export const deriveStrongLexiconModuleRevision = (
  moduleId: CanonicalStrongLexiconModulePublication['moduleId'],
  tables: CanonicalStrongLexiconModulePublication['tables'],
  dependencies: CanonicalStrongLexiconModulePublication['dependencies'] = []
): string =>
  `strong-lexicon-${moduleId}-${createHash('sha256')
    .update(
      JSON.stringify(
        (function normalizeLexicon(value: unknown): unknown {
          if (Array.isArray(value)) return value.map(normalizeLexicon)
          if (value && typeof value === 'object') {
            return Object.fromEntries(
              Object.entries(value)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, normalizeLexicon(nested)])
            )
          }
          return value
        })({ moduleId, dependencies, tables })
      )
    )
    .digest('hex')
    .slice(0, 24)}`

const validateStrongLexiconRows = (
  moduleId: CanonicalStrongLexiconModulePublication['moduleId'],
  tables: CanonicalStrongLexiconModulePublication['tables'],
  schemaVersion: CanonicalStrongLexiconModulePublication['schemaVersion']
) => {
  const ids = new Map<string, Set<number>>()
  for (const table of strongLexiconTables(moduleId, schemaVersion)) {
    const expectedColumns = STRONG_LEXICON_TABLE_COLUMNS[moduleId][table]
    const rows = tables[table] ?? []
    const required = new Set(STRONG_LEXICON_REQUIRED_COLUMNS[moduleId][table] ?? [])
    const primary = STRONG_LEXICON_TABLE_PRIMARY_KEYS[moduleId][table] ?? []
    const uniqueKey = STRONG_LEXICON_TABLE_UNIQUE_KEYS[moduleId][table] ?? []
    const seen = new Set<string>()
    const seenUnique = new Set<string>()
    if (rows.length === 0) throw new Error('CANONICAL_STRONG_LEXICON_TABLE_EMPTY')
    for (const row of rows) {
      const keys = Object.keys(row).sort()
      if (keys.join('|') !== [...expectedColumns].sort().join('|')) {
        throw new Error('CANONICAL_STRONG_LEXICON_ROW_COLUMNS_INVALID')
      }
      for (const [key, value] of Object.entries(row)) {
        if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
          throw new Error('CANONICAL_STRONG_LEXICON_ROW_VALUE_INVALID')
        }
        if (STRONG_LEXICON_POSITIVE_INTEGER_COLUMNS.has(key) && value !== null) {
          if (!isPositiveInteger(value)) {
            throw new Error('CANONICAL_STRONG_LEXICON_ROW_IDENTITY_INVALID')
          }
        }
        if (
          STRONG_LEXICON_REQUIRED_INTEGER_COLUMNS[moduleId][table]?.includes(key) &&
          !isPositiveInteger(value)
        ) {
          throw new Error('CANONICAL_STRONG_LEXICON_ROW_REQUIRED_IDENTITY_INVALID')
        }
        if (required.has(key) && (typeof value !== 'string' || !value.trim())) {
          throw new Error('CANONICAL_STRONG_LEXICON_ROW_REQUIRED_INVALID')
        }
      }
      const keyColumns = primary.length ? primary : uniqueKey
      const primaryKey = keyColumns.map(column => String(row[column] ?? '')).join('\u001f')
      if (keyColumns.length && seen.has(primaryKey)) {
        throw new Error('CANONICAL_STRONG_LEXICON_ROW_DUPLICATE')
      }
      if (keyColumns.length) seen.add(primaryKey)
      if (uniqueKey.length) {
        const uniqueValue = uniqueKey.map(column => String(row[column] ?? '')).join('\u001f')
        if (seenUnique.has(uniqueValue)) {
          throw new Error('CANONICAL_STRONG_LEXICON_ROW_UNIQUE_DUPLICATE')
        }
        seenUnique.add(uniqueValue)
      }
    }
    const idColumn =
      table === 'StepEntries' ||
      table === 'RelationKinds' ||
      table === 'MorphologyCodes' ||
      table === 'LexiconResources' ||
      table === 'Entities'
        ? 'id'
        : undefined
    if (idColumn) ids.set(table, new Set(rows.map(row => Number(row[idColumn]))))
  }
  const references = (table: string, column: string, target: string) => {
    const targetIds = ids.get(target)
    if (!targetIds) return
    for (const row of tables[table] ?? []) {
      const value = row[column]
      if (value !== null && !targetIds.has(Number(value))) {
        throw new Error('CANONICAL_STRONG_LEXICON_REFERENCE_INVALID')
      }
    }
  }
  if (moduleId === 'core') {
    const entryById = new Map((tables.StepEntries ?? []).map(row => [Number(row.id), row]))
    for (const row of tables.StepEntryIdentities ?? []) {
      const entry = entryById.get(Number(row.stepEntryId))
      const identity = String(row.stepCode)
      const dStrongIdentity = String(entry?.dStrong ?? '').split(/\s+/u)[0]
      if (!entry || ![entry.eStrong, entry.uStrong, dStrongIdentity].includes(identity)) {
        throw new Error('CANONICAL_STRONG_LEXICON_IDENTITY_MISMATCH')
      }
    }
    if (
      (tables.StepEntries ?? []).some(row => !['greek', 'hebrew'].includes(String(row.language)))
    ) {
      throw new Error('CANONICAL_STRONG_LEXICON_LANGUAGE_INVALID')
    }
    if (
      (tables.LexiconRelations ?? []).some(
        row => !['subentry', 'identity', 'family'].includes(String(row.groupKind))
      )
    ) {
      throw new Error('CANONICAL_STRONG_LEXICON_RELATION_GROUP_INVALID')
    }
    references('StepEntryIdentities', 'stepEntryId', 'StepEntries')
    references('LexiconTranslations', 'stepEntryId', 'StepEntries')
    references('LexiconNameMeanings', 'stepEntryId', 'StepEntries')
    references('LexiconRelations', 'fromStepEntryId', 'StepEntries')
    references('LexiconRelations', 'toStepEntryId', 'StepEntries')
    references('LexiconRelations', 'relationKindId', 'RelationKinds')
    references('MorphologyCodeTranslations', 'morphologyCodeId', 'MorphologyCodes')
    const identityCodes = new Map(
      (tables.StepEntryIdentities ?? []).map(row => [Number(row.stepEntryId), String(row.stepCode)])
    )
    for (const row of tables.LexiconRelations ?? []) {
      if (
        row.toStepEntryId !== null &&
        identityCodes.get(Number(row.toStepEntryId)) !== String(row.toStepCode)
      ) {
        throw new Error('CANONICAL_STRONG_LEXICON_RELATION_TARGET_MISMATCH')
      }
    }
  } else if (moduleId === 'resources') {
    references('LexiconResourceTranslations', 'resourceId', 'LexiconResources')
  } else {
    references('EntityTranslations', 'entityId', 'Entities')
    references('EntityRefs', 'entityId', 'Entities')
    references('EntityRelations', 'fromEntityId', 'Entities')
    references('EntityRelations', 'toEntityId', 'Entities')
    references('EntityPlaces', 'entityId', 'Entities')
    const entityNames = new Map(
      (tables.Entities ?? []).map(row => [Number(row.id), String(row.uniqueName)])
    )
    for (const row of tables.EntityRelations ?? []) {
      if (
        row.toEntityId !== null &&
        entityNames.get(Number(row.toEntityId)) !== String(row.toUniqueName).split('|').at(-1)
      ) {
        throw new Error('CANONICAL_STRONG_LEXICON_ENTITY_TARGET_MISMATCH')
      }
    }
  }
}

const validateStrongLexiconSqliteTableSchema = (
  database: Database,
  moduleId: CanonicalStrongLexiconModulePublication['moduleId'],
  table: string
) => {
  const columns = rowsFromSqlJs(database, `PRAGMA table_info("${table}")`)
  const expected = STRONG_LEXICON_TABLE_COLUMNS[moduleId][table]
  if (
    columns
      .map(column => String(column.name))
      .sort()
      .join('|') !== [...expected].sort().join('|')
  ) {
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
  }
  for (const column of columns) {
    const expectedType = STRONG_LEXICON_SQLITE_REAL_COLUMNS.has(String(column.name))
      ? 'REAL'
      : STRONG_LEXICON_SQLITE_INTEGER_COLUMNS.has(String(column.name))
        ? 'INTEGER'
        : 'TEXT'
    if (String(column.type).toUpperCase() !== expectedType) {
      throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
    }
    const primaryIntegerColumn = Number(column.pk) === 1 && expectedType === 'INTEGER'
    if (
      !STRONG_LEXICON_SQLITE_OPTIONAL_COLUMNS.has(String(column.name)) &&
      Number(column.notnull) !== 1 &&
      !primaryIntegerColumn
    ) {
      throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
    }
  }
  const primary = columns
    .filter(column => Number(column.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map(column => String(column.name))
  if (primary.join('|') !== (STRONG_LEXICON_TABLE_PRIMARY_KEYS[moduleId][table] ?? []).join('|')) {
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
  }
  const uniqueColumns = STRONG_LEXICON_SQLITE_UNIQUE_COLUMNS[moduleId][table] ?? []
  if (uniqueColumns.length) {
    const quoted = uniqueColumns.map(column => `"${column}"`).join(',')
    const duplicate = rowsFromSqlJs(
      database,
      `SELECT ${quoted}, COUNT(*) AS count FROM "${table}" GROUP BY ${quoted} HAVING COUNT(*) > 1 LIMIT 1`
    )
    if (duplicate.length) throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
  }
}

export const decodeCanonicalStrongLexiconModule = (
  value: unknown
): CanonicalStrongLexiconModulePublication => {
  if (!value || typeof value !== 'object') throw new Error('CANONICAL_STRONG_LEXICON_INVALID')
  const candidate = value as Partial<CanonicalStrongLexiconModulePublication>
  if (
    candidate.format !== 'bible-strong-canonical-strong-lexicon-module' ||
    ![1, 2].includes(candidate.schemaVersion ?? 0) ||
    !candidate.moduleId ||
    !Object.hasOwn(STRONG_LEXICON_TABLES, candidate.moduleId) ||
    typeof candidate.revision !== 'string' ||
    !candidate.revision ||
    !Array.isArray(candidate.dependencies) ||
    !candidate.tables ||
    typeof candidate.tables !== 'object' ||
    !candidate.counts ||
    typeof candidate.counts !== 'object'
  ) {
    throw new Error('CANONICAL_STRONG_LEXICON_INVALID')
  }
  const schemaVersion = candidate.schemaVersion as 1 | 2
  const expectedTables = strongLexiconTables(candidate.moduleId, schemaVersion)
  if (
    Object.keys(candidate.tables).sort().join('|') !== [...expectedTables].sort().join('|') ||
    Object.keys(candidate.counts ?? {})
      .sort()
      .join('|') !== [...expectedTables].sort().join('|') ||
    expectedTables.some(table => {
      const rows = candidate.tables?.[table]
      return (
        !Array.isArray(rows) ||
        rows.some(
          row =>
            !row ||
            typeof row !== 'object' ||
            Array.isArray(row) ||
            Object.values(row).some(
              field => field !== null && typeof field !== 'string' && typeof field !== 'number'
            )
        ) ||
        candidate.counts?.[table] !== rows.length
      )
    }) ||
    deriveStrongLexiconModuleRevision(
      candidate.moduleId,
      candidate.tables,
      candidate.dependencies
    ) !== candidate.revision
  ) {
    throw new Error('CANONICAL_STRONG_LEXICON_INVALID')
  }
  if (
    (candidate.moduleId === 'core' && candidate.dependencies.length !== 0) ||
    (candidate.moduleId !== 'core' &&
      (candidate.dependencies.length !== 1 ||
        candidate.dependencies[0]?.resourceIdentity !== 'strong-lexicon:core' ||
        !candidate.dependencies[0]?.revision))
  ) {
    throw new Error('CANONICAL_STRONG_LEXICON_DEPENDENCY_INVALID')
  }
  validateStrongLexiconRows(candidate.moduleId, candidate.tables, schemaVersion)
  return candidate as CanonicalStrongLexiconModulePublication
}

const rowsFromSqlJs = (
  database: Database,
  sqlText: string
): Record<string, string | number | null>[] => {
  const result = database.exec(sqlText)[0]
  if (!result) return []
  return result.values.map(values =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index] ?? null]))
  ) as Record<string, string | number | null>[]
}

const validateStrongLexiconOfflineParity = async (
  bytes: Uint8Array,
  canonical: CanonicalStrongLexiconModulePublication
) => {
  const SQL = await initSqlJs()
  let database: Database | undefined
  try {
    database = new SQL.Database(bytes)
    const integrity = rowsFromSqlJs(database, 'PRAGMA integrity_check')
    const integrityValue = Object.values(integrity[0] ?? {})[0]
    if (integrity.length !== 1 || integrityValue !== 'ok') {
      throw new Error('OFFLINE_ARTIFACT_INTEGRITY_INVALID')
    }
    if (rowsFromSqlJs(database, 'PRAGMA foreign_key_check').length > 0) {
      throw new Error('OFFLINE_ARTIFACT_FOREIGN_KEY_INVALID')
    }
    const metadataTable = canonical.moduleId === 'entities' ? 'EntityMeta' : 'DictionaryMeta'
    const actualTables = rowsFromSqlJs(
      database,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).map(row => String(row.name))
    const expectedTables = strongLexiconTables(canonical.moduleId, canonical.schemaVersion)
    const allowedTables = new Set([
      ...expectedTables,
      metadataTable,
      ...(canonical.moduleId === 'entities' ? ['EntityNames', 'EntityTranslationProvenance'] : []),
    ])
    if (actualTables.some(table => !allowedTables.has(table))) {
      throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID')
    }
    const metadataColumns = rowsFromSqlJs(database, `PRAGMA table_info("${metadataTable}")`)
    if (
      metadataColumns.length !== 2 ||
      metadataColumns.map(column => String(column.name)).join('|') !== 'key|value' ||
      metadataColumns.some(
        column =>
          String(column.type).toUpperCase() !== 'TEXT' ||
          Number(column.notnull) !== 1 ||
          (String(column.name) === 'key' && Number(column.pk) !== 1) ||
          (String(column.name) === 'value' && Number(column.pk) !== 0)
      )
    ) {
      throw new Error('OFFLINE_ARTIFACT_METADATA_SCHEMA_INVALID')
    }
    const actualContent = Object.fromEntries(
      expectedTables.map(table => {
        const columns = rowsFromSqlJs(database!, `PRAGMA table_info("${table}")`)
        validateStrongLexiconSqliteTableSchema(database!, canonical.moduleId, table)
        const primary = columns
          .filter(column => Number(column.pk) > 0)
          .sort((left, right) => Number(left.pk) - Number(right.pk))
          .map(column => `"${String(column.name)}"`)
        const fallback = columns.map(column => `"${String(column.name)}"`)
        return [
          table,
          rowsFromSqlJs(
            database!,
            `SELECT * FROM "${table}" ORDER BY ${(primary.length ? primary : fallback).join(',')}`
          ),
        ]
      })
    )
    if (
      JSON.stringify(normalizeJson(actualContent)) !==
      JSON.stringify(normalizeJson(canonical.tables))
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
    const metadata = Object.fromEntries(
      rowsFromSqlJs(database, `SELECT key,value FROM ${metadataTable}`).map(row => [
        String(row.key),
        String(row.value),
      ])
    )
    if (
      metadata.resourceIdentity !== `strong-lexicon:${canonical.moduleId}` ||
      metadata.resourceRevision !== canonical.revision ||
      metadata.moduleKind !== canonical.moduleId ||
      metadata.moduleSchemaVersion !== String(canonical.schemaVersion + 1) ||
      (canonical.moduleId !== 'core' &&
        metadata.coreRevision !== canonical.dependencies[0]?.revision)
    ) {
      throw new Error('OFFLINE_ARTIFACT_METADATA_MISMATCH')
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('OFFLINE_ARTIFACT_')) throw cause
    throw new Error('OFFLINE_ARTIFACT_SCHEMA_INVALID', { cause })
  } finally {
    database?.close()
  }
}

export const validatePublicationBundle = async (bundlePath: string) => {
  const root = path.resolve(bundlePath)
  const manifestPath = path.join(root, 'manifest.json')
  const [manifestStat, resolvedManifest, resolvedRoot] = await Promise.all([
    lstat(manifestPath),
    realpath(manifestPath),
    realpath(root),
  ])
  if (
    !manifestStat.isFile() ||
    manifestStat.size > 1024 * 1024 ||
    !resolvedManifest.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error('PUBLICATION_BUNDLE_MANIFEST_PATH_INVALID')
  }
  const manifestRaw = await readFile(manifestPath, 'utf8')
  const manifest = decodePublicationBundleManifest(JSON.parse(manifestRaw))
  const canonicalPath = path.resolve(root, manifest.canonical.path)
  const offlineArtifactPath = path.resolve(root, manifest.offlineArtifact.path)

  await Promise.all([
    assertArtifact(canonicalPath, manifest.canonical, 'CANONICAL_ARTIFACT', root),
    assertArtifact(offlineArtifactPath, manifest.offlineArtifact, 'OFFLINE_ARTIFACT', root),
  ])

  let offlineEntries: ReturnType<typeof unzipSync>
  try {
    const archive = await readFile(offlineArtifactPath)
    if (archive.byteLength > 512 * 1024 * 1024) throw new Error('archive-too-large')
    const seenEntries: string[] = []
    const expectedEntries = new Set(
      manifest.offlineArtifact.entries
        ? Object.values(manifest.offlineArtifact.entries)
            .filter(entry => entry !== undefined)
            .map(entry => entry.entry)
        : [manifest.offlineArtifact.entry]
    )
    offlineEntries = unzipSync(archive, {
      filter: entry => {
        seenEntries.push(entry.name)
        if (
          !expectedEntries.has(entry.name) ||
          entry.originalSize > 512 * 1024 * 1024 ||
          entry.originalSize > Math.max(entry.size * 250, 1024 * 1024)
        ) {
          throw new Error('archive-entry-invalid')
        }
        return true
      },
    })
    if (
      seenEntries.length !== expectedEntries.size ||
      seenEntries.some(entry => !expectedEntries.has(entry))
    ) {
      throw new Error('archive-entries-invalid')
    }
  } catch (cause) {
    throw new Error('OFFLINE_ARTIFACT_INVALID', { cause })
  }
  const offlineContent = offlineEntries[manifest.offlineArtifact.entry]
  if (!offlineContent) throw new Error('OFFLINE_ARTIFACT_ENTRY_MISSING')
  if (
    createHash('sha256').update(offlineContent).digest('hex') !==
    manifest.offlineArtifact.contentSha256
  ) {
    throw new Error('OFFLINE_ARTIFACT_ENTRY_CHECKSUM_MISMATCH')
  }
  if (
    (isNavePublicationBundleManifest(manifest) ||
      isDictionaryPublicationBundleManifest(manifest) ||
      isDictionaryDirectoryPublicationBundleManifest(manifest) ||
      isCommentaryPublicationBundleManifest(manifest) ||
      isCrossReferencePublicationBundleManifest(manifest) ||
      isStrongBiblePublicationBundleManifest(manifest) ||
      isInterlinearBiblePublicationBundleManifest(manifest) ||
      isStrongLexiconPublicationBundleManifest(manifest)) &&
    !Buffer.from(offlineContent)
      .subarray(0, 16)
      .equals(Buffer.from('SQLite format 3\u0000', 'utf8'))
  ) {
    throw new Error('OFFLINE_ARTIFACT_FORMAT_INVALID')
  }

  const canonicalValue: unknown = JSON.parse(await readFile(canonicalPath, 'utf8'))
  let canonical: CanonicalPublication
  if (isBiblePublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalBible(canonicalValue)
    const textSha256 = hashCanonicalVerses(canonical.verses)
    if (
      canonical.applicationVersionId !== manifest.identity.versionId ||
      canonical.textSha256 !== textSha256 ||
      canonical.textRevision !==
        `${canonical.applicationVersionId.toLowerCase()}-${textSha256.slice(0, 20)}` ||
      canonical.textRevision !== manifest.revision ||
      canonical.sourceVersion !== manifest.provenance.sourceVersion ||
      canonical.sourceSha256 !== manifest.provenance.sourceSha256
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }

    const counts = countCanonicalContent(canonical)
    if (
      JSON.stringify(counts) !== JSON.stringify(manifest.counts) ||
      canonical.verseCount !== counts.verses ||
      canonical.noteCount !== counts.notes ||
      canonical.headingCount !== counts.headings
    ) {
      throw new Error('PUBLICATION_BUNDLE_COUNT_MISMATCH')
    }
    const coverage = getCanonicalCoverage(canonical)
    if (
      coverage.orderedBooks.some(book => !manifest.canon.orderedBooks.includes(book)) ||
      JSON.stringify(manifest.coverage) !==
        JSON.stringify({
          chaptersByBook: coverage.chaptersByBook,
          verseCountByBookChapter: coverage.verseCountByBookChapter,
        })
    ) {
      throw new Error('PUBLICATION_BUNDLE_COVERAGE_MISMATCH')
    }
    const declaredEntries = manifest.offlineArtifact.entries ?? {
      canonical: {
        entry: manifest.offlineArtifact.entry,
        sha256: manifest.offlineArtifact.contentSha256,
        bytes: offlineContent.byteLength,
      },
    }
    const decodedEntries: Partial<Record<'canonical' | 'pericope' | 'redWords', unknown>> = {}
    for (const [role, declaration] of Object.entries(declaredEntries)) {
      if (!declaration) continue
      const content = offlineEntries[declaration.entry]
      if (!content) throw new Error('OFFLINE_ARTIFACT_ENTRY_MISSING')
      if (
        content.byteLength !== declaration.bytes ||
        createHash('sha256').update(content).digest('hex') !== declaration.sha256
      ) {
        throw new Error('OFFLINE_ARTIFACT_ENTRY_CHECKSUM_MISMATCH')
      }
      decodedEntries[role as keyof typeof decodedEntries] = JSON.parse(
        Buffer.from(content).toString()
      )
    }
    const archivedValue = decodedEntries.canonical
    if (!archivedValue) throw new Error('OFFLINE_ARTIFACT_ENTRY_MISSING')
    const archivedCanonical =
      (archivedValue as Partial<CanonicalBiblePublication>).format ===
      'bible-strong-canonical-bible'
        ? decodeCanonicalBible(archivedValue)
        : buildCanonicalBibleFromLegacy({
            versionId: manifest.identity.versionId,
            sourceVersion: manifest.provenance.sourceVersion,
            sourceSha256: manifest.provenance.sourceSha256,
            bible: archivedValue,
            pericope: decodedEntries.pericope,
            redWords: decodedEntries.redWords,
          })
    if (JSON.stringify(archivedCanonical.verses) !== JSON.stringify(canonical.verses)) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } else if (isNavePublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalNave(canonicalValue)
    if (
      canonical.resourceId !== manifest.identity.resourceId ||
      canonical.revision !== manifest.revision ||
      canonical.sourceVersion !== manifest.provenance.sourceVersion ||
      canonical.sourceSha256 !== manifest.provenance.sourceSha256
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    if (JSON.stringify(countCanonicalNaveContent(canonical)) !== JSON.stringify(manifest.counts)) {
      throw new Error('PUBLICATION_BUNDLE_COUNT_MISMATCH')
    }
    if (
      JSON.stringify(getCanonicalNaveAlphabeticalBrowse(canonical)) !==
      JSON.stringify(manifest.alphabeticalBrowse)
    ) {
      throw new Error('PUBLICATION_BUNDLE_ALPHABETICAL_BROWSE_MISMATCH')
    }
    await validateNaveOfflineParity(offlineContent, canonical)
  } else if (isDictionaryPublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalDictionary(canonicalValue)
    if (
      canonical.resourceId !== manifest.identity.resourceId ||
      canonical.work !== manifest.identity.work ||
      canonical.language !== manifest.identity.language ||
      JSON.stringify(canonical.editorial) !== JSON.stringify(manifest.editorial) ||
      canonical.revision !== manifest.revision ||
      deriveDictionaryResourceRevision(canonical) !== manifest.revision ||
      canonical.sourceVersion !== manifest.provenance.sourceVersion ||
      canonical.sourceSha256 !== manifest.provenance.sourceSha256
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    if (
      JSON.stringify(countCanonicalDictionaryContent(canonical)) !== JSON.stringify(manifest.counts)
    ) {
      throw new Error('PUBLICATION_BUNDLE_COUNT_MISMATCH')
    }
    if (
      JSON.stringify(getCanonicalDictionaryAlphabeticalBrowse(canonical)) !==
      JSON.stringify(manifest.alphabeticalBrowse)
    ) {
      throw new Error('PUBLICATION_BUNDLE_ALPHABETICAL_BROWSE_MISMATCH')
    }
    await validateDictionaryOfflineParity(offlineContent, canonical)
  } else if (isDictionaryDirectoryPublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalDictionaryDirectory(canonicalValue)
    if (
      canonical.revision !== manifest.revision ||
      canonical.contentSha256 !== manifest.offlineArtifact.contentSha256 ||
      JSON.stringify(canonical.counts) !== JSON.stringify(manifest.counts)
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    await validateDictionaryDirectoryOfflineParity(offlineContent, canonical)
  } else if (isCommentaryPublicationBundleManifest(manifest)) {
    const commentaryCanonical = decodeCanonicalCommentary(canonicalValue)
    canonical = commentaryCanonical
    if (
      commentaryCanonical.resourceId !== manifest.identity.resourceId ||
      commentaryCanonical.language !== manifest.identity.language ||
      commentaryCanonical.revision !== manifest.revision ||
      commentaryCanonical.sourceVersion !== manifest.provenance.sourceVersion ||
      commentaryCanonical.sourceSha256 !== manifest.provenance.sourceSha256 ||
      manifest.counts.verses !== commentaryCanonical.verses.length ||
      manifest.counts.characters !==
        (() => {
          const documents =
            commentaryCanonical.schemaVersion === 2
              ? new Map(
                  commentaryCanonical.documents.map(document => [document.id, document.content])
                )
              : undefined
          return commentaryCanonical.verses.reduce(
            (total, verse) =>
              total + commentaryVerseContent(commentaryCanonical, verse, documents).length,
            0
          )
        })()
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    await validateCommentaryOfflineParity(offlineContent, commentaryCanonical)
  } else if (isCrossReferencePublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalCrossReferences(canonicalValue)
    if (
      canonical.resourceId !== manifest.identity.resourceId ||
      canonical.language !== manifest.identity.language ||
      canonical.revision !== manifest.revision ||
      canonical.sourceVersion !== manifest.provenance.sourceVersion ||
      canonical.sourceSha256 !== manifest.provenance.sourceSha256 ||
      manifest.counts.verseAnchors !== canonical.verseAnchors.length ||
      manifest.counts.references !==
        canonical.verseAnchors.reduce((total, anchor) => total + anchor.references.length, 0)
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    await validateCrossReferenceOfflineParity(offlineContent, canonical)
  } else if (isTimelinePublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalTimeline(canonicalValue)
    if (
      canonical.resourceId !== manifest.identity.resourceId ||
      canonical.language !== manifest.identity.language ||
      canonical.revision !== manifest.revision ||
      deriveTimelineResourceRevision(canonical) !== manifest.revision ||
      canonical.sourceVersion !== manifest.provenance.sourceVersion ||
      canonical.sourceSha256 !== manifest.provenance.sourceSha256 ||
      JSON.stringify(countCanonicalTimelineContent(canonical)) !== JSON.stringify(manifest.counts)
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    let archivedEvents: unknown
    try {
      archivedEvents = JSON.parse(Buffer.from(offlineContent).toString('utf8'))
    } catch (cause) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_INVALID', { cause })
    }
    if (
      !Array.isArray(archivedEvents) ||
      JSON.stringify(archivedEvents) !== JSON.stringify(canonical.events)
    ) {
      throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
    }
  } else if (isStrongBiblePublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalStrongBible(canonicalValue)
    if (
      canonical.applicationVersionId !== manifest.identity.versionId ||
      canonical.datasetId !== manifest.identity.datasetId ||
      deriveStrongBibleResourceRevision(canonical) !== manifest.revision ||
      canonical.textRevision !== manifest.dependencies.bible.revision ||
      canonical.textSha256 !== manifest.dependencies.bible.textSha256
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    if (
      JSON.stringify(countCanonicalStrongBibleContent(canonical)) !==
      JSON.stringify(manifest.counts)
    ) {
      throw new Error('PUBLICATION_BUNDLE_COUNT_MISMATCH')
    }
    await validateStrongBibleOfflineParity(offlineContent, canonical)
  } else if (isInterlinearBiblePublicationBundleManifest(manifest)) {
    canonical = decodeCanonicalInterlinearBible(canonicalValue)
    if (
      canonical.applicationVersionId !== manifest.identity.versionId ||
      canonical.datasetId !== manifest.identity.datasetId ||
      canonical.language !== manifest.identity.language ||
      canonical.indexRevision !== manifest.revision ||
      deriveInterlinearBibleResourceRevision(canonical) !== manifest.revision ||
      canonical.textRevision !== manifest.dependencies.bible.revision ||
      canonical.textSha256 !== manifest.dependencies.bible.textSha256
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    if (
      JSON.stringify(countCanonicalInterlinearBibleContent(canonical)) !==
      JSON.stringify(manifest.counts)
    ) {
      throw new Error('PUBLICATION_BUNDLE_COUNT_MISMATCH')
    }
    await validateInterlinearBibleOfflineParity(offlineContent, canonical)
  } else {
    canonical = decodeCanonicalStrongLexiconModule(canonicalValue)
    if (
      canonical.moduleId !== manifest.identity.moduleId ||
      canonical.revision !== manifest.revision ||
      JSON.stringify(normalizeJson(canonical.dependencies)) !==
        JSON.stringify(normalizeJson(manifest.dependencies)) ||
      JSON.stringify(normalizeJson(canonical.counts)) !==
        JSON.stringify(normalizeJson(manifest.counts))
    ) {
      throw new Error('PUBLICATION_BUNDLE_IDENTITY_MISMATCH')
    }
    await validateStrongLexiconOfflineParity(offlineContent, canonical)
  }

  return { manifest, canonical, canonicalPath, offlineArtifactPath, offlineContent }
}
