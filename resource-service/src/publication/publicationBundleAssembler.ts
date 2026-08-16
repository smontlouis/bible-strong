import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { unzipSync } from 'fflate'

import {
  countCanonicalContent,
  decodeCanonicalBible,
  getCanonicalCoverage,
  validatePublicationBundle,
  type PublicationBundleManifest,
} from './publicationBundle'

export type AssembleBiblePublicationOptions = {
  artifactPath: string
  entry: string
  outputPath: string
  language: string
  canon: string
  versification: string
  rights: PublicationBundleManifest['rights']
  deliveryCapabilities?: PublicationBundleManifest['deliveryCapabilities']
  generatedAt?: string
}

const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')

const assertOutputDoesNotExist = async (outputPath: string) => {
  try {
    await access(outputPath)
  } catch {
    return
  }
  throw new Error(`PUBLICATION_BUNDLE_OUTPUT_EXISTS:${outputPath}`)
}

export const assembleBiblePublicationBundle = async (options: AssembleBiblePublicationOptions) => {
  const artifactPath = path.resolve(options.artifactPath)
  const outputPath = path.resolve(options.outputPath)
  await assertOutputDoesNotExist(outputPath)

  const archive = await readFile(artifactPath)
  let entries: ReturnType<typeof unzipSync>
  try {
    entries = unzipSync(archive)
  } catch (cause) {
    throw new Error('OFFLINE_ARTIFACT_INVALID', { cause })
  }
  const canonicalBytes = entries[options.entry]
  if (!canonicalBytes) throw new Error(`OFFLINE_ARTIFACT_ENTRY_MISSING:${options.entry}`)
  const canonical = decodeCanonicalBible(JSON.parse(Buffer.from(canonicalBytes).toString('utf8')))
  const counts = countCanonicalContent(canonical)
  const coverage = getCanonicalCoverage(canonical)
  if (
    canonical.verseCount !== counts.verses ||
    canonical.noteCount !== counts.notes ||
    canonical.headingCount !== counts.headings
  ) {
    throw new Error('PUBLICATION_BUNDLE_COUNT_MISMATCH')
  }

  const outputParent = path.dirname(outputPath)
  await mkdir(outputParent, { recursive: true })
  const temporaryPath = await mkdtemp(path.join(outputParent, `.${path.basename(outputPath)}.tmp-`))
  const canonicalName = `bible-${canonical.applicationVersionId.toLowerCase()}.json`
  const archiveName = `${canonicalName}.zip`

  try {
    await Promise.all([
      mkdir(path.join(temporaryPath, 'canonical')),
      mkdir(path.join(temporaryPath, 'offline')),
    ])
    await Promise.all([
      writeFile(path.join(temporaryPath, 'canonical', canonicalName), canonicalBytes),
      writeFile(path.join(temporaryPath, 'offline', archiveName), archive),
    ])

    const manifest: PublicationBundleManifest = {
      format: 'bible-strong-resource-publication',
      schemaVersion: 1,
      identity: {
        kind: 'bible-text',
        versionId: canonical.applicationVersionId,
        language: options.language,
      },
      revision: canonical.textRevision,
      canonical: {
        path: `canonical/${canonicalName}`,
        mediaType: 'application/json',
        schemaVersion: canonical.schemaVersion,
        sha256: sha256(canonicalBytes),
        bytes: canonicalBytes.byteLength,
      },
      offlineArtifact: {
        path: `offline/${archiveName}`,
        mediaType: 'application/zip',
        entry: options.entry,
        sha256: sha256(archive),
        bytes: archive.byteLength,
        contentSha256: sha256(canonicalBytes),
      },
      provenance: {
        generator: 'bible-lexicon-maker',
        sourceVersion: canonical.sourceVersion,
        sourceSha256: canonical.sourceSha256,
        generatedAt: options.generatedAt ?? new Date().toISOString(),
      },
      rights: options.rights,
      deliveryCapabilities: options.deliveryCapabilities ?? {
        onlineAccess: true,
        offlineDownload: true,
      },
      canon: { id: options.canon, orderedBooks: coverage.orderedBooks },
      versification: options.versification,
      coverage: {
        chaptersByBook: coverage.chaptersByBook,
        verseCountByBookChapter: coverage.verseCountByBookChapter,
      },
      counts,
    }
    await writeFile(
      path.join(temporaryPath, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    )
    await validatePublicationBundle(temporaryPath)
    await rename(temporaryPath, outputPath)
    return validatePublicationBundle(outputPath)
  } catch (cause) {
    await rm(temporaryPath, { recursive: true, force: true })
    throw cause
  }
}
