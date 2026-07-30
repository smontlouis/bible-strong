import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import {
  getMultipleVerses,
  insertBibleVersion,
  openBiblesDb,
  type BibleJsonData,
  type CanonicalBibleJsonData,
  type InsertBibleOptions,
  type LegacyBibleJsonData,
} from '~helpers/biblesDb'
import {
  downloadWithCdnFallback,
  type DownloadWithCdnFallbackResult,
} from '~helpers/downloadWithCdnFallback'
import type { StrongBiblePublication } from '~helpers/strongBiblePublications'
import type { InterlinearPublicationArtifact } from '~helpers/interlinearBiblePublications'
import { planWordAnnotationRealignment } from '~helpers/wordAnnotationRealignment'
import { realignWordAnnotationsAction } from '~redux/modules/user'
import { persistor, store } from '~redux/store'
import { getFileSha256, toNativeFilePath } from './fileIntegrity'
import {
  clearAnnotationMigrationJournal,
  persistAnnotationMigrationJournal,
} from './annotationMigrationJournal'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'
import { countImportableBibleVerses } from './bibleJsonImport'

export interface DownloadAndInsertOptions extends InsertBibleOptions {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  /** Return the DownloadResumable so the caller can pause/cancel it */
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  canonicalArtifact?: StrongBiblePublication['canonical']
  archiveArtifact?: InterlinearPublicationArtifact
  installationLifecycle?: ResourceInstallationLifecycle
}

/**
 * Downloads a Bible JSON from a remote URL and inserts it into bibles.sqlite.
 *
 * Flow:
 * 1. Download JSON to cacheDirectory (temp file)
 * 2. Parse JSON
 * 3. insertBibleVersion() into SQLite
 * 4. Delete temp file
 */
export async function downloadAndInsertBible(
  versionId: string,
  downloadUrl: string,
  onProgressOrOptions?: FileSystem.DownloadProgressCallback | DownloadAndInsertOptions
): Promise<DownloadWithCdnFallbackResult> {
  // Normalize arguments: support both legacy callback and new options object
  const opts: DownloadAndInsertOptions =
    typeof onProgressOrOptions === 'function'
      ? { onDownloadProgress: onProgressOrOptions }
      : (onProgressOrOptions ?? {})

  // Ensure DB is open
  await openBiblesDb()

  const archiveArtifact = opts.canonicalArtifact ?? opts.archiveArtifact
  const isArchive = Boolean(archiveArtifact)
  const tempPath = `${FileSystem.cacheDirectory}bible-${versionId}-temp.${
    isArchive ? 'zip' : 'json'
  }`
  const extractionDirectory = `${FileSystem.cacheDirectory}bible-${versionId}-extract/`

  try {
    // 1. Download to temp file
    console.log(`[DownloadBible] Downloading ${versionId} from ${downloadUrl}`)
    const downloadResult = await downloadWithCdnFallback({
      url: downloadUrl,
      destinationPath: tempPath,
      downloadOptions: { cache: false },
      onDownloadProgress: opts.onDownloadProgress,
      onResumable: opts.onResumable,
      isCancelled: opts.isCancelled,
      logTag: 'DownloadBible',
    })

    // Check cancellation after download
    if (opts.isCancelled?.()) {
      throw new Error('CANCELLED')
    }

    const jsonPath = await resolveDownloadedBibleJson({
      downloadedPath: tempPath,
      extractionDirectory,
      archiveArtifact,
    })
    const data = await FileSystem.readAsStringAsync(jsonPath)
    const jsonData = JSON.parse(data) as BibleJsonData
    validateCanonicalBiblePublication(versionId, jsonData, opts.canonicalArtifact)
    const importableVerseCount = isCanonicalBibleJsonData(jsonData)
      ? countImportableBibleVerses(jsonData.verses)
      : countImportableBibleVerses(jsonData)
    await opts.installationLifecycle?.prepare(downloadResult)
    const downloadedTextChecksum = await getFileSha256(jsonPath)
    const revisionPrefix =
      opts.archiveArtifact?.textRevision.split('-')[0] ?? versionId.toLowerCase()
    const downloadedTextRevision = `${revisionPrefix}-${downloadedTextChecksum.slice(0, 20)}`
    const targetTextRevision = isCanonicalBibleJsonData(jsonData)
      ? jsonData.textRevision
      : archiveArtifact
        ? downloadedTextRevision
        : undefined
    const realignmentPlan = await buildRealignmentPlan(versionId, jsonData, targetTextRevision)
    if (realignmentPlan && Object.keys(realignmentPlan.updates).length > 0) {
      persistAnnotationMigrationJournal({
        versionId,
        textRevision: targetTextRevision!,
        updates: realignmentPlan.updates,
      })
    }

    // 3. Insert into SQLite
    console.log(`[DownloadBible] Inserting ${versionId} into bibles.sqlite`)
    await insertBibleVersion(versionId, jsonData, {
      onInsertProgress: opts.onInsertProgress,
      isCancelled: opts.isCancelled,
      beforeCommit: () => opts.installationLifecycle?.commit(downloadResult),
      ...(isCanonicalBibleJsonData(jsonData)
        ? {
            publicationMetadata: {
              textRevision: jsonData.textRevision,
              textSha256: jsonData.textSha256,
              sourceSha256: jsonData.sourceSha256,
              schemaVersion: jsonData.schemaVersion,
              verseCount: jsonData.verseCount,
              resourceGeneration: downloadResult.publication.generation,
            },
          }
        : opts.archiveArtifact
          ? {
              publicationMetadata: {
                textRevision: downloadedTextRevision,
                textSha256: downloadedTextChecksum,
                sourceSha256: downloadedTextChecksum,
                schemaVersion: opts.archiveArtifact.schemaVersion,
                verseCount: importableVerseCount,
                resourceGeneration: downloadResult.publication.generation,
              },
            }
          : {
              publicationMetadata: {
                textRevision: downloadedTextRevision,
                textSha256: downloadedTextChecksum,
                sourceSha256: downloadedTextChecksum,
                schemaVersion: 0,
                verseCount: importableVerseCount,
                resourceGeneration: downloadResult.publication.generation,
              },
            }),
    })
    if (realignmentPlan && Object.keys(realignmentPlan.updates).length > 0) {
      try {
        store.dispatch(realignWordAnnotationsAction(realignmentPlan.updates))
        await persistor.flush()
        clearAnnotationMigrationJournal()
      } catch (error) {
        console.error(
          `[DownloadBible] ${versionId} installed, but annotation realignment persistence failed:`,
          error
        )
      }
    }
    if (realignmentPlan?.unchangedAmbiguousAnnotationIds.length) {
      console.info(
        `[DownloadBible] Kept ${realignmentPlan.unchangedAmbiguousAnnotationIds.length} ` +
          `ambiguous ${versionId} annotation(s) unchanged`
      )
    }

    console.log(`[DownloadBible] ${versionId} ready`)
    return downloadResult
  } finally {
    // 4. Clean up temp file
    const tempInfo = await FileSystem.getInfoAsync(tempPath)
    if (tempInfo.exists) {
      await FileSystem.deleteAsync(tempPath, { idempotent: true })
    }
    const extractionInfo = await FileSystem.getInfoAsync(extractionDirectory)
    if (extractionInfo.exists) {
      await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
    }
  }
}

const resolveDownloadedBibleJson = async ({
  downloadedPath,
  extractionDirectory,
  archiveArtifact,
}: {
  downloadedPath: string
  extractionDirectory: string
  archiveArtifact?: StrongBiblePublication['canonical'] | InterlinearPublicationArtifact
}): Promise<string> => {
  if (!archiveArtifact) return downloadedPath

  await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
  await unzip(toNativeFilePath(downloadedPath), toNativeFilePath(extractionDirectory), 'UTF-8')
  const jsonPath = `${extractionDirectory}${archiveArtifact.entry}`
  const info = await FileSystem.getInfoAsync(jsonPath)
  if (!info.exists) {
    throw new Error(`CANONICAL_BIBLE_ARCHIVE_ENTRY_MISSING:${archiveArtifact.entry}`)
  }
  return jsonPath
}

const isCanonicalBibleJsonData = (data: BibleJsonData): data is CanonicalBibleJsonData =>
  'format' in data && data.format === 'bible-strong-canonical-bible'

const validateCanonicalBiblePublication = (
  versionId: string,
  data: BibleJsonData,
  artifact?: StrongBiblePublication['canonical']
): void => {
  if (!artifact) return
  if (!isCanonicalBibleJsonData(data)) {
    throw new Error('CANONICAL_BIBLE_INVALID_FORMAT')
  }
  if (data.applicationVersionId !== versionId || data.schemaVersion !== artifact.schemaVersion) {
    throw new Error('CANONICAL_BIBLE_METADATA_MISMATCH')
  }
}

const buildRealignmentPlan = async (
  versionId: string,
  data: BibleJsonData,
  publicationTextRevision?: string
) => {
  const canonicalData = isCanonicalBibleJsonData(data) ? data : undefined
  const textRevision = canonicalData?.textRevision ?? publicationTextRevision
  if (!textRevision) return null
  const annotations = store.getState().user.bible.wordAnnotations
  const sourceVersions = new Set([versionId])
  const affectedAnnotations = Object.values(annotations).filter(
    annotation =>
      sourceVersions.has(annotation.version) &&
      (annotation.version !== versionId || annotation.textRevision !== textRevision)
  )
  if (affectedAnnotations.length === 0) return null

  const verseKeys = [
    ...new Set(
      affectedAnnotations.flatMap(annotation => annotation.ranges.map(range => range.verseKey))
    ),
  ]
  const previousVerses = await getMultipleVerses(versionId, verseKeys)
  const candidateVerses = Object.fromEntries(
    verseKeys.flatMap(verseKey => {
      const [book, chapter, verse] = verseKey.split('-')
      const versePayload = canonicalData
        ? canonicalData.verses[book]?.[chapter]?.[verse]
        : (data as LegacyBibleJsonData)[book]?.[chapter]?.[verse]
      const candidate = typeof versePayload === 'string' ? versePayload : versePayload?.text
      return candidate === undefined ? [] : [[verseKey, candidate]]
    })
  )

  return planWordAnnotationRealignment({
    annotations,
    version: versionId,
    textRevision,
    candidateVerses,
    previousVersesByVersion: {
      [versionId]: previousVerses,
    },
  })
}
