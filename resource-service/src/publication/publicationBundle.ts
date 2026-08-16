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
} from '../../../src/features/resources/bibleChapterContract'
import {
  getStrongBibleCatalogIdentity,
  isStrongBibleVersionId,
} from '../../../src/helpers/strongBibleCatalog'
import { STRONG_IDENTITY_KINDS } from '../../../src/helpers/strongIdentities'

const Sha256 = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const Language = Schema.String.pipe(Schema.pattern(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/))
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
    entry: Schema.Literal('nave-fr.sqlite'),
  }),
  identity: Schema.Struct({
    kind: Schema.Literal('nave'),
    resourceId: Schema.Literal('NAVE_FR'),
    language: Schema.Literal('fr'),
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

const PublicationBundleManifestSchema = Schema.Union(
  BiblePublicationBundleManifestSchema,
  NavePublicationBundleManifestSchema,
  StrongBiblePublicationBundleManifestSchema
)

export type BiblePublicationBundleManifest = typeof BiblePublicationBundleManifestSchema.Type
export type NavePublicationBundleManifest = typeof NavePublicationBundleManifestSchema.Type
export type StrongBiblePublicationBundleManifest =
  typeof StrongBiblePublicationBundleManifestSchema.Type
export type PublicationBundleManifest =
  | BiblePublicationBundleManifest
  | NavePublicationBundleManifest
  | StrongBiblePublicationBundleManifest

export const isBiblePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is BiblePublicationBundleManifest => manifest.identity.kind === 'bible-text'

export const isNavePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is NavePublicationBundleManifest => manifest.identity.kind === 'nave'

export const isStrongBiblePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is StrongBiblePublicationBundleManifest =>
  manifest.identity.kind === 'strong-bible-index'

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
  resourceId: 'NAVE_FR'
  revision: string
  sourceVersion: string
  sourceSha256: string
  topics: CanonicalNaveTopic[]
  verseAnchors: CanonicalNaveVerseAnchor[]
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

export type CanonicalPublication =
  | CanonicalBiblePublication
  | CanonicalNavePublication
  | CanonicalStrongBiblePublication

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
    candidate.resourceId !== 'NAVE_FR' ||
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

export const countCanonicalStrongBibleContent = (publication: CanonicalStrongBiblePublication) => ({
  verses: publication.verses.length,
  occurrences: publication.spans.length,
  unalignedOccurrences: publication.spans.filter(span => !span.isAligned).length,
  identities: publication.spanIdentities.length,
  lexemeAssignments: publication.spans.filter(span => span.lexemeId !== undefined).length,
  lexemes: publication.lexemes.length,
})

export const deriveStrongBibleResourceRevision = (
  publication: CanonicalStrongBiblePublication
): string => {
  const digest = createHash('sha256')
    .update(JSON.stringify(normalizeJson(publication)))
    .digest('hex')
  return `${publication.applicationVersionId.toLowerCase()}-strong-${digest.slice(0, 20)}`
}

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
      isStrongBiblePublicationBundleManifest(manifest)) &&
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
  } else {
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
  }

  return { manifest, canonical, canonicalPath, offlineArtifactPath }
}
