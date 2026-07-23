import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import {
  getMultipleVerses,
  insertBibleVersion,
  openBiblesDb,
  type BibleJsonData,
  type CanonicalBibleJsonData,
  type InsertBibleOptions,
} from '~helpers/biblesDb'
import { downloadWithCdnFallback } from '~helpers/downloadWithCdnFallback'
import type { StrongBiblePublication } from '~helpers/strongBiblePublications'
import { planWordAnnotationRealignment } from '~helpers/wordAnnotationRealignment'
import { realignWordAnnotationsAction } from '~redux/modules/user'
import { persistor, store } from '~redux/store'
import { toNativeFilePath, verifyFileSha256 } from './fileIntegrity'
import {
  clearAnnotationMigrationJournal,
  persistAnnotationMigrationJournal,
} from './annotationMigrationJournal'

export interface DownloadAndInsertOptions extends InsertBibleOptions {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  /** Return the DownloadResumable so the caller can pause/cancel it */
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  canonicalArtifact?: StrongBiblePublication['canonical']
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
): Promise<void> {
  // Normalize arguments: support both legacy callback and new options object
  const opts: DownloadAndInsertOptions =
    typeof onProgressOrOptions === 'function'
      ? { onDownloadProgress: onProgressOrOptions }
      : (onProgressOrOptions ?? {})

  // Ensure DB is open
  await openBiblesDb()

  const isArchive = Boolean(opts.canonicalArtifact)
  const tempPath = `${FileSystem.cacheDirectory}bible-${versionId}-temp.${
    isArchive ? 'zip' : 'json'
  }`
  const extractionDirectory = `${FileSystem.cacheDirectory}bible-${versionId}-extract/`

  try {
    // 1. Download to temp file
    console.log(`[DownloadBible] Downloading ${versionId} from ${downloadUrl}`)
    await downloadWithCdnFallback({
      url: downloadUrl,
      destinationPath: tempPath,
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
      canonicalArtifact: opts.canonicalArtifact,
    })
    const data = await FileSystem.readAsStringAsync(jsonPath)
    const jsonData = JSON.parse(data) as BibleJsonData
    validateCanonicalBiblePublication(versionId, jsonData, opts.canonicalArtifact)
    const realignmentPlan = await buildRealignmentPlan(versionId, jsonData)
    if (realignmentPlan && Object.keys(realignmentPlan.updates).length > 0) {
      persistAnnotationMigrationJournal({
        versionId,
        textRevision: (jsonData as CanonicalBibleJsonData).textRevision,
        updates: realignmentPlan.updates,
      })
    }

    // 3. Insert into SQLite
    console.log(`[DownloadBible] Inserting ${versionId} into bibles.sqlite`)
    await insertBibleVersion(versionId, jsonData, {
      onInsertProgress: opts.onInsertProgress,
      isCancelled: opts.isCancelled,
    })
    if (realignmentPlan && Object.keys(realignmentPlan.updates).length > 0) {
      store.dispatch(realignWordAnnotationsAction(realignmentPlan.updates))
      await persistor.flush()
      clearAnnotationMigrationJournal()
    }
    if (realignmentPlan?.unchangedAmbiguousAnnotationIds.length) {
      console.info(
        `[DownloadBible] Kept ${realignmentPlan.unchangedAmbiguousAnnotationIds.length} ` +
          `ambiguous ${versionId} annotation(s) unchanged`
      )
    }

    console.log(`[DownloadBible] ${versionId} ready`)
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
  canonicalArtifact,
}: {
  downloadedPath: string
  extractionDirectory: string
  canonicalArtifact?: StrongBiblePublication['canonical']
}): Promise<string> => {
  if (!canonicalArtifact) return downloadedPath

  await verifyFileSha256(
    downloadedPath,
    canonicalArtifact.archiveSha256,
    'CANONICAL_BIBLE_ARCHIVE_CHECKSUM_MISMATCH'
  )
  await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
  await unzip(toNativeFilePath(downloadedPath), toNativeFilePath(extractionDirectory), 'UTF-8')
  const jsonPath = `${extractionDirectory}${canonicalArtifact.entry}`
  const info = await FileSystem.getInfoAsync(jsonPath)
  if (!info.exists) {
    throw new Error(`CANONICAL_BIBLE_ARCHIVE_ENTRY_MISSING:${canonicalArtifact.entry}`)
  }
  await verifyFileSha256(
    jsonPath,
    canonicalArtifact.contentSha256,
    'CANONICAL_BIBLE_CONTENT_CHECKSUM_MISMATCH'
  )
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
  if (
    data.applicationVersionId !== versionId ||
    data.textRevision !== artifact.textRevision ||
    data.textSha256 !== artifact.textSha256 ||
    data.schemaVersion !== artifact.schemaVersion ||
    data.verseCount !== artifact.verseCount
  ) {
    throw new Error('CANONICAL_BIBLE_METADATA_MISMATCH')
  }
}

const buildRealignmentPlan = async (versionId: string, data: BibleJsonData) => {
  if (!isCanonicalBibleJsonData(data)) return null
  const annotations = store.getState().user.bible.wordAnnotations
  const sourceVersions = versionId === 'LSG' ? new Set(['LSG', 'LSGS']) : new Set([versionId])
  const affectedAnnotations = Object.values(annotations).filter(
    annotation =>
      sourceVersions.has(annotation.version) &&
      (annotation.version !== versionId || annotation.textRevision !== data.textRevision)
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
      const candidate = data.verses[book]?.[chapter]?.[verse]?.text
      return candidate === undefined ? [] : [[verseKey, candidate]]
    })
  )

  return planWordAnnotationRealignment({
    annotations,
    version: versionId,
    textRevision: data.textRevision,
    candidateVerses,
    previousVersesByVersion: {
      [versionId]: previousVerses,
    },
  })
}
