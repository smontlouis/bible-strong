import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { Schema } from 'effect'
import { unzipSync } from 'fflate'
import initSqlJs, { type Database } from 'sql.js'

import {
  BibleVersePresentationDto,
  type BibleVersePresentation,
} from '../../../src/features/resources/bibleChapterContract'

const Sha256 = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const Language = Schema.String.pipe(Schema.pattern(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/))
const Artifact = Schema.Struct({
  path: Schema.NonEmptyString,
  mediaType: Schema.NonEmptyString,
  sha256: Sha256,
  bytes: Schema.NonNegativeInt,
})

const PublicationBundleCommonFields = {
  format: Schema.Literal('bible-strong-resource-publication'),
  schemaVersion: Schema.Literal(1),
  revision: Schema.NonEmptyString,
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
  }),
  provenance: Schema.Struct({
    generator: Schema.Literal('bible-lexicon-maker'),
    sourceVersion: Schema.NonEmptyString,
    sourceSha256: Sha256,
    generatedAt: Schema.NonEmptyString,
  }),
  rights: Schema.Struct({
    holder: Schema.NonEmptyString,
    termsReference: Schema.NonEmptyString,
    attribution: Schema.NonEmptyString,
    online: Schema.Boolean,
    offline: Schema.Boolean,
  }),
  deliveryCapabilities: Schema.Struct({
    onlineAccess: Schema.Boolean,
    offlineDownload: Schema.Boolean,
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

const PublicationBundleManifestSchema = Schema.Union(
  BiblePublicationBundleManifestSchema,
  NavePublicationBundleManifestSchema
)

export type BiblePublicationBundleManifest = typeof BiblePublicationBundleManifestSchema.Type
export type NavePublicationBundleManifest = typeof NavePublicationBundleManifestSchema.Type
export type PublicationBundleManifest =
  | BiblePublicationBundleManifest
  | NavePublicationBundleManifest

export const isBiblePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is BiblePublicationBundleManifest => manifest.identity.kind === 'bible-text'

export const isNavePublicationBundleManifest = (
  manifest: PublicationBundleManifest
): manifest is NavePublicationBundleManifest => manifest.identity.kind === 'nave'

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

export type CanonicalPublication = CanonicalBiblePublication | CanonicalNavePublication

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

  if (
    !isSafeBundlePath(manifest.canonical.path) ||
    !isSafeBundlePath(manifest.offlineArtifact.path) ||
    !isSafeBundlePath(manifest.offlineArtifact.entry)
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

  return manifest
}

const fileSha256 = async (filePath: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex')

const assertArtifact = async (
  filePath: string,
  artifact: { sha256: string; bytes: number },
  label: string
) => {
  const fileStat = await stat(filePath)
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
        if (!/^[1-9]\d*$/.test(verseNumber) || !verse || typeof verse.text !== 'string') {
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

export const validatePublicationBundle = async (bundlePath: string) => {
  const root = path.resolve(bundlePath)
  const manifestRaw = await readFile(path.join(root, 'manifest.json'), 'utf8')
  const manifest = decodePublicationBundleManifest(JSON.parse(manifestRaw))
  const canonicalPath = path.resolve(root, manifest.canonical.path)
  const offlineArtifactPath = path.resolve(root, manifest.offlineArtifact.path)

  await Promise.all([
    assertArtifact(canonicalPath, manifest.canonical, 'CANONICAL_ARTIFACT'),
    assertArtifact(offlineArtifactPath, manifest.offlineArtifact, 'OFFLINE_ARTIFACT'),
  ])

  if (
    isBiblePublicationBundleManifest(manifest) &&
    manifest.offlineArtifact.contentSha256 !== manifest.canonical.sha256
  ) {
    throw new Error('OFFLINE_ARTIFACT_CONTENT_MISMATCH')
  }

  let offlineEntries: ReturnType<typeof unzipSync>
  try {
    offlineEntries = unzipSync(await readFile(offlineArtifactPath))
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
    isNavePublicationBundleManifest(manifest) &&
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
    if (
      canonical.applicationVersionId !== manifest.identity.versionId ||
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
      JSON.stringify(manifest.canon.orderedBooks) !== JSON.stringify(coverage.orderedBooks) ||
      JSON.stringify(manifest.coverage) !==
        JSON.stringify({
          chaptersByBook: coverage.chaptersByBook,
          verseCountByBookChapter: coverage.verseCountByBookChapter,
        })
    ) {
      throw new Error('PUBLICATION_BUNDLE_COVERAGE_MISMATCH')
    }
  } else {
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
  }

  return { manifest, canonical, canonicalPath, offlineArtifactPath }
}
