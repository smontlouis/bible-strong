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
import { getFileSha256, toNativeFilePath, verifyFileSha256 } from './fileIntegrity'
import {
  clearAnnotationMigrationJournal,
  persistAnnotationMigrationJournal,
} from './annotationMigrationJournal'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'
import { countImportableBibleVerses } from './bibleJsonImport'
import { validatePericopeResource, validateRedWordsResource } from './bibleResourceValidation'
import { rollbackActivatedResourceFiles, type ActivatedResourceFile } from './atomicResourceFile'

export type BibleArchiveEntries = {
  canonical: string
  pericope?: string
  redWords?: string
}

export interface DownloadAndInsertOptions extends InsertBibleOptions {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  /** Return the DownloadResumable so the caller can pause/cancel it */
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  canonicalArtifact?: StrongBiblePublication['canonical']
  archiveArtifact?: InterlinearPublicationArtifact
  archiveEntry?: string
  archiveEntries?: BibleArchiveEntries
  expectedArchiveSha256?: string
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
  const archiveEntry = archiveArtifact?.entry ?? opts.archiveEntries?.canonical ?? opts.archiveEntry
  const isArchive = Boolean(archiveEntry)
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

    if (opts.expectedArchiveSha256) {
      await verifyFileSha256(
        tempPath,
        opts.expectedArchiveSha256,
        `BIBLE_ARCHIVE_CHECKSUM_MISMATCH:${versionId}`
      )
    }

    const jsonPath = await resolveDownloadedBibleJson({
      downloadedPath: tempPath,
      extractionDirectory,
      archiveEntry,
    })
    const data = await FileSystem.readAsStringAsync(jsonPath)
    const jsonData = JSON.parse(data) as BibleJsonData
    validateCanonicalBiblePublication(versionId, jsonData, opts.canonicalArtifact)
    const optionalFiles = await validateOptionalBibleBundleEntries({
      versionId,
      extractionDirectory,
      entries: opts.archiveEntries,
    })
    const importableVerseCount = isCanonicalBibleJsonData(jsonData)
      ? countImportableBibleVerses(jsonData.verses)
      : countImportableBibleVerses(jsonData)
    await opts.installationLifecycle?.prepare(downloadResult, {
      kind: 'bible-sqlite',
      versionId,
      bundleFiles: optionalFiles.map(file => ({
        destinationPath: file.destinationPath,
        previousCopyExisted: file.previousCopyExisted,
      })),
    })
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

    const bundleActivation = await activateOptionalBibleBundleFiles(optionalFiles)
    try {
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
    } catch (error) {
      await rollbackActivatedResourceFiles(bundleActivation, error)
      throw error
    }
    await completeOptionalBibleBundleFiles(bundleActivation)
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

const validateOptionalBibleBundleEntries = async ({
  versionId,
  extractionDirectory,
  entries,
}: {
  versionId: string
  extractionDirectory: string
  entries?: BibleArchiveEntries
}): Promise<{ candidatePath: string; destinationPath: string; previousCopyExisted: boolean }[]> => {
  const files: {
    candidatePath: string
    destinationPath: string
    previousCopyExisted: boolean
  }[] = []
  for (const optional of [
    entries?.pericope
      ? {
          entry: entries.pericope,
          destinationPath: `${FileSystem.documentDirectory}bible-${versionId.toLowerCase()}-pericope.json`,
          validate: validatePericopeResource,
        }
      : undefined,
    entries?.redWords
      ? {
          entry: entries.redWords,
          destinationPath: `${FileSystem.documentDirectory}red-words-${versionId}.json`,
          validate: validateRedWordsResource,
        }
      : undefined,
  ]) {
    if (!optional) continue
    const candidatePath = `${extractionDirectory}${optional.entry}`
    const info = await FileSystem.getInfoAsync(candidatePath)
    if (!info.exists || info.isDirectory) {
      throw new Error(`BIBLE_ARCHIVE_ENTRY_MISSING:${optional.entry}`)
    }
    optional.validate(JSON.parse(await FileSystem.readAsStringAsync(candidatePath)) as unknown)
    const installed = await FileSystem.getInfoAsync(optional.destinationPath)
    files.push({
      candidatePath,
      destinationPath: optional.destinationPath,
      previousCopyExisted: installed.exists,
    })
  }
  return files
}

const activateOptionalBibleBundleFiles = async (
  files: readonly {
    candidatePath: string
    destinationPath: string
    previousCopyExisted: boolean
  }[]
): Promise<ActivatedResourceFile[]> => {
  const activations: ActivatedResourceFile[] = []
  try {
    for (const file of files) {
      const backupPath = `${file.destinationPath}.bundle-backup`
      await FileSystem.deleteAsync(backupPath, { idempotent: true })
      const activation = {
        destinationPath: file.destinationPath,
        backupPath,
        previousCopyMoved: file.previousCopyExisted,
      }
      if (file.previousCopyExisted) {
        await FileSystem.moveAsync({ from: file.destinationPath, to: backupPath })
      }
      activations.push(activation)
      await FileSystem.moveAsync({ from: file.candidatePath, to: file.destinationPath })
    }
    return activations
  } catch (error) {
    await rollbackActivatedResourceFiles(activations, error)
    throw error
  }
}

const completeOptionalBibleBundleFiles = async (
  activations: readonly ActivatedResourceFile[]
): Promise<void> => {
  for (const activation of activations) {
    try {
      await FileSystem.deleteAsync(activation.backupPath, { idempotent: true })
    } catch (error) {
      console.warn('[DownloadBible] Could not remove bundle backup:', error)
    }
  }
}

const resolveDownloadedBibleJson = async ({
  downloadedPath,
  extractionDirectory,
  archiveEntry,
}: {
  downloadedPath: string
  extractionDirectory: string
  archiveEntry?: string
}): Promise<string> => {
  if (!archiveEntry) return downloadedPath

  await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
  await unzip(toNativeFilePath(downloadedPath), toNativeFilePath(extractionDirectory), 'UTF-8')
  const jsonPath = `${extractionDirectory}${archiveEntry}`
  const info = await FileSystem.getInfoAsync(jsonPath)
  if (!info.exists) {
    throw new Error(`BIBLE_ARCHIVE_ENTRY_MISSING:${archiveEntry}`)
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
