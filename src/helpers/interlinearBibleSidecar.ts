import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import { getBibleVersionMetadata } from './biblesDb'
import { getSharedSqliteDirPath, type ResourceLanguage } from './databaseTypes'
import { downloadWithCdnFallback } from './downloadWithCdnFallback'
import { toNativeFilePath } from './fileIntegrity'
import {
  BHG_INTERLINEAR_PUBLICATION,
  type InterlinearBibleVersionId,
  type InterlinearPublicationArtifact,
} from './interlinearBiblePublications'
import { openSQLiteDatabase, type SQLiteDatabase } from './sqlite'
import { restoreOrphanedResourceBackup } from './atomicResourceFile'

const databases = new Map<ResourceLanguage, SQLiteDatabase>()

export type InterlinearIdentityKind = 'strong' | 'estrong' | 'dstrong' | 'ustrong'

export interface InterlinearSegment {
  ordinal: number
  startOffset: number
  length: number
  transliteration: string
  lemma: string
  morphology: string
  gloss: string
  identities: { kind: InterlinearIdentityKind; code: string }[]
}

export interface InterlinearToken {
  id?: number
  ordinal: number
  startOffset: number
  length: number
  segments: InterlinearSegment[]
}

export type InterlinearChapterTokens = Record<number, InterlinearToken[]>

export type InterlinearSidecarAvailability =
  | { status: 'base-missing' }
  | { status: 'base-incompatible' }
  | { status: 'missing' }
  | { status: 'incompatible' }
  | { status: 'corrupt'; reason: string }
  | { status: 'available'; locale: ResourceLanguage; textRevision: string }

export interface InterlinearSidecarInstallCallbacks {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  onStatusInserting?: () => void
  onInsertProgress?: (progress: number) => void
  isCancelled?: () => boolean
}

export const getInterlinearSidecarDirectory = () => `${getSharedSqliteDirPath()}/interlinear-bibles`

export const getInterlinearSidecarPath = (locale: ResourceLanguage) =>
  `${getInterlinearSidecarDirectory()}/bible-bhg-interlinear-${locale}.sqlite`

export const getInterlinearSidecarAvailability = async (
  locale: ResourceLanguage
): Promise<InterlinearSidecarAvailability> => {
  const baseMetadata = await getBibleVersionMetadata('BHG')
  if (!baseMetadata) return { status: 'base-missing' }
  const sidecarPath = getInterlinearSidecarPath(locale)
  await restoreOrphanedResourceBackup(sidecarPath, `${sidecarPath}.backup`)
  const info = await FileSystem.getInfoAsync(sidecarPath)
  if (!info.exists) return { status: 'missing' }

  try {
    const database = await openInterlinearSidecar(locale)
    const metadata = await readMetadata(database)
    if (
      metadata.schemaVersion !==
        String(BHG_INTERLINEAR_PUBLICATION.indexes[locale].schemaVersion) ||
      metadata.datasetId !== BHG_INTERLINEAR_PUBLICATION.datasetId ||
      metadata.locale !== locale ||
      metadata.textRevision !== baseMetadata.textRevision ||
      metadata.textSha256 !== baseMetadata.textSha256
    ) {
      return { status: 'incompatible' }
    }
    const integrity = await database.getFirstAsync<{ integrity_check: string }>(
      'PRAGMA integrity_check'
    )
    if (integrity?.integrity_check !== 'ok') {
      return { status: 'corrupt', reason: integrity?.integrity_check ?? 'integrity-check-missing' }
    }
    return {
      status: 'available',
      locale,
      textRevision: metadata.textRevision,
    }
  } catch (error) {
    return { status: 'corrupt', reason: error instanceof Error ? error.message : String(error) }
  }
}

export const installInterlinearSidecar = async (
  locale: ResourceLanguage,
  artifact: InterlinearPublicationArtifact,
  datasetId: 'STEP',
  callbacks: InterlinearSidecarInstallCallbacks = {}
) => {
  const baseMetadata = await getBibleVersionMetadata('BHG')
  if (!baseMetadata) throw new Error('INTERLINEAR_BASE_MISSING:BHG')
  const archivePath = `${FileSystem.cacheDirectory}bhg-interlinear-${locale}.zip`
  const extractionDirectory = `${FileSystem.cacheDirectory}bhg-interlinear-${locale}/`
  const extractedPath = `${extractionDirectory}${artifact.entry}`
  try {
    const downloadResult = await downloadWithCdnFallback({
      url: artifact.url,
      destinationPath: archivePath,
      downloadOptions: { cache: false },
      onDownloadProgress: callbacks.onDownloadProgress,
      onResumable: callbacks.onResumable,
      isCancelled: callbacks.isCancelled,
      logTag: 'InterlinearBibleSidecar',
    })
    if (callbacks.isCancelled?.()) throw new Error('CANCELLED')
    callbacks.onStatusInserting?.()
    callbacks.onInsertProgress?.(0)
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
    await unzip(toNativeFilePath(archivePath), toNativeFilePath(extractionDirectory), 'UTF-8')
    callbacks.onInsertProgress?.(0.5)
    const candidate = await openSQLiteDatabase(
      artifact.entry,
      { useNewConnection: true },
      extractionDirectory
    )
    try {
      const metadata = await readMetadata(candidate)
      const integrity = await candidate.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check'
      )
      if (
        integrity?.integrity_check !== 'ok' ||
        metadata.schemaVersion !== String(artifact.schemaVersion) ||
        metadata.datasetId !== datasetId ||
        metadata.locale !== locale ||
        metadata.textRevision !== baseMetadata.textRevision ||
        metadata.textSha256 !== baseMetadata.textSha256
      ) {
        throw new Error('INTERLINEAR_SIDECAR_VALIDATION_FAILED')
      }
    } finally {
      await candidate.closeAsync()
    }
    callbacks.onInsertProgress?.(0.8)
    await activateInterlinearSidecar(locale, extractedPath)
    callbacks.onInsertProgress?.(1)
    return downloadResult
  } finally {
    callbacks.onResumable?.(null)
    await FileSystem.deleteAsync(archivePath, { idempotent: true })
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  }
}

export const removeInterlinearSidecar = async (locale: ResourceLanguage) => {
  await closeInterlinearSidecar(locale)
  await FileSystem.deleteAsync(getInterlinearSidecarPath(locale), { idempotent: true })
}

export const loadInterlinearChapterTokens = async (
  _versionId: InterlinearBibleVersionId,
  locale: ResourceLanguage,
  book: number,
  chapter: number
): Promise<InterlinearChapterTokens> => {
  const availability = await getInterlinearSidecarAvailability(locale)
  if (availability.status !== 'available') {
    throw new Error(`INTERLINEAR_SIDECAR_${availability.status.toUpperCase()}:BHG:${locale}`)
  }
  const database = await openInterlinearSidecar(locale)
  const rows = await database.getAllAsync<{
    verse: number
    tokenId: number
    readingOrdinal: number
    tokenStartOffset: number
    tokenLength: number
    segmentOrdinal: number
    segmentStartOffset: number
    segmentLength: number
    transliteration: string
    lemma: string
    morphology: string
    gloss: string
    strong: string | null
    estrong: string | null
    dstrong: string | null
    ustrong: string | null
  }>(
    `SELECT v.verse, t.id AS tokenId, t.readingOrdinal,
            t.startOffset AS tokenStartOffset, t.length AS tokenLength,
            s.ordinal AS segmentOrdinal, s.startOffset AS segmentStartOffset,
            s.length AS segmentLength, tr.value AS transliteration,
            l.value AS lemma, m.code AS morphology, g.text AS gloss,
            c0.code AS strong, c1.code AS estrong,
            c2.code AS dstrong, c3.code AS ustrong
       FROM Verses v
       JOIN Tokens t ON t.verseId=v.id
       JOIN Segments s ON s.tokenId=t.id
       JOIN Transliterations tr ON tr.id=s.transliterationId
       JOIN Lemmas l ON l.id=s.lemmaId
       JOIN Morphologies m ON m.id=s.morphologyId
       JOIN Glosses g ON g.id=s.glossId
       LEFT JOIN StrongCodes c0 ON c0.id=s.strongCodeId
       LEFT JOIN StrongCodes c1 ON c1.id=s.eStrongCodeId
       LEFT JOIN StrongCodes c2 ON c2.id=s.dStrongCodeId
       LEFT JOIN StrongCodes c3 ON c3.id=s.uStrongCodeId
      WHERE v.bookOrder=? AND v.chapter=?
      ORDER BY v.verse, t.readingOrdinal, s.ordinal`,
    [book, chapter]
  )
  const result: InterlinearChapterTokens = {}
  const tokens = new Map<number, InterlinearToken>()
  for (const row of rows) {
    let token = tokens.get(row.tokenId)
    if (!token) {
      token = {
        id: row.tokenId,
        ordinal: row.readingOrdinal,
        startOffset: row.tokenStartOffset,
        length: row.tokenLength,
        segments: [],
      }
      tokens.set(row.tokenId, token)
      result[row.verse] ??= []
      result[row.verse].push(token)
    }
    const identities = (
      [
        ['strong', row.strong],
        ['estrong', row.estrong],
        ['dstrong', row.dstrong],
        ['ustrong', row.ustrong],
      ] as const
    ).flatMap(([kind, code]) => (code ? [{ kind, code }] : []))
    token.segments.push({
      ordinal: row.segmentOrdinal,
      startOffset: row.segmentStartOffset,
      length: row.segmentLength,
      transliteration: row.transliteration,
      lemma: row.lemma,
      morphology: row.morphology,
      gloss: row.gloss,
      identities,
    })
  }
  return result
}

const openInterlinearSidecar = async (locale: ResourceLanguage) => {
  const existing = databases.get(locale)
  if (existing) return existing
  const directory = getInterlinearSidecarDirectory()
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
  const filename = `bible-bhg-interlinear-${locale}.sqlite`
  const database = await openSQLiteDatabase(filename, { useNewConnection: true }, directory)
  databases.set(locale, database)
  return database
}

const closeInterlinearSidecar = async (locale: ResourceLanguage) => {
  const database = databases.get(locale)
  if (!database) return
  databases.delete(locale)
  await database.closeAsync()
}

const readMetadata = async (database: SQLiteDatabase) => {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM ResourceMetadata'
  )
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]))
}

const activateInterlinearSidecar = async (locale: ResourceLanguage, extractedPath: string) => {
  const destination = getInterlinearSidecarPath(locale)
  const backup = `${destination}.backup`
  await FileSystem.makeDirectoryAsync(getInterlinearSidecarDirectory(), { intermediates: true })
  await closeInterlinearSidecar(locale)
  await restoreOrphanedResourceBackup(destination, backup)
  await FileSystem.deleteAsync(backup, { idempotent: true })
  const current = await FileSystem.getInfoAsync(destination)
  if (current.exists) await FileSystem.moveAsync({ from: destination, to: backup })
  try {
    await FileSystem.moveAsync({ from: extractedPath, to: destination })
    await FileSystem.deleteAsync(backup, { idempotent: true })
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true })
    const backupInfo = await FileSystem.getInfoAsync(backup)
    if (backupInfo.exists) await FileSystem.moveAsync({ from: backup, to: destination })
    throw error
  }
}
