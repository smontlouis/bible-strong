import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { Schema } from 'effect'
import { unzipSync } from 'fflate'

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

const PublicationBundleManifestSchema = Schema.Struct({
  format: Schema.Literal('bible-strong-resource-publication'),
  schemaVersion: Schema.Literal(1),
  identity: Schema.Struct({
    kind: Schema.Literal('bible-text'),
    versionId: Schema.NonEmptyString,
    language: Language,
  }),
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

export type PublicationBundleManifest = typeof PublicationBundleManifestSchema.Type

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
    manifest.canon.orderedBooks.length === 0 ||
    Object.values(manifest.coverage.chaptersByBook).some(chapters => chapters.length === 0)
  ) {
    throw new Error('PUBLICATION_BUNDLE_COVERAGE_INVALID')
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

  if (manifest.offlineArtifact.contentSha256 !== manifest.canonical.sha256) {
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
  if (createHash('sha256').update(offlineContent).digest('hex') !== manifest.canonical.sha256) {
    throw new Error('OFFLINE_ARTIFACT_ENTRY_CHECKSUM_MISMATCH')
  }

  const canonical = decodeCanonicalBible(JSON.parse(await readFile(canonicalPath, 'utf8')))
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

  return { manifest, canonical, canonicalPath, offlineArtifactPath }
}
