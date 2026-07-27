import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import { getBibleVersionMetadata } from './biblesDb'
import { getSharedSqliteDirPath } from './databaseTypes'
import { downloadWithCdnFallback } from './downloadWithCdnFallback'
import { toNativeFilePath, verifyFileSha256 } from './fileIntegrity'
import { openSQLiteDatabase, type SQLiteDatabase } from './sqlite'
import {
  classifyStrongBibleSidecarMetadata,
  validateStrongBibleSidecarSnapshot,
  type ExpectedStrongBibleSidecar,
  type StrongBibleSidecarCounts,
  type StrongBibleSidecarMetadata,
  type StrongBibleSidecarSnapshot,
} from './strongBibleSidecarValidation'
import {
  getStrongBiblePublication,
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from './strongBiblePublications'
import type { StrongBibleIdentityKind, StrongBibleSpan } from './strongBibleOverlay'

const sidecarDatabases = new Map<StrongBibleVersionId, SQLiteDatabase>()
const validatedSidecars = new Map<StrongBibleVersionId, StrongBibleSidecarMetadata>()
const IDENTITY_KINDS = ['strong', 'estrong', 'dstrong', 'ustrong'] as const

export type StrongBibleSidecarAvailability =
  | { status: 'unsupported' }
  | { status: 'base-missing' }
  | {
      status: 'base-incompatible'
      baseTextRevision?: string
      requiredTextRevision: string
    }
  | { status: 'missing' }
  | {
      status: 'incompatible'
      baseTextRevision?: string
      sidecarTextRevision?: string
    }
  | { status: 'corrupt'; reason: string }
  | {
      status: 'available'
      versionId: StrongBibleVersionId
      datasetId: string
      textRevision: string
      strongRevision: string
    }

export interface StrongBibleSidecarInstallCallbacks {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  onStatusInserting?: () => void
  onInsertProgress?: (progress: number) => void
  isCancelled?: () => boolean
}

export const getStrongBibleSidecarDirectory = (): string =>
  `${getSharedSqliteDirPath()}/strong-bibles`

export const getStrongBibleSidecarPath = (versionId: StrongBibleVersionId): string =>
  `${getStrongBibleSidecarDirectory()}/${getStrongBibleSidecarFileName(versionId)}`

const getStrongBibleSidecarFileName = (versionId: StrongBibleVersionId): string =>
  `bible-${versionId.toLowerCase()}-strong.sqlite`

export const getStrongBibleSidecarAvailability = async (
  versionId: string
): Promise<StrongBibleSidecarAvailability> => {
  if (!isStrongCapableBibleVersion(versionId)) return { status: 'unsupported' }
  const publication = getStrongBiblePublication(versionId)
  const baseMetadata = await getBibleVersionMetadata(versionId)
  if (!baseMetadata) return { status: 'base-missing' }
  if (
    baseMetadata.textRevision !== publication.strong.textRevision ||
    baseMetadata.textSha256 !== publication.strong.textSha256
  ) {
    return {
      status: 'base-incompatible',
      baseTextRevision: baseMetadata.textRevision,
      requiredTextRevision: publication.strong.textRevision,
    }
  }

  const path = getStrongBibleSidecarPath(versionId)
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return { status: 'missing' }

  try {
    const database = await openStrongBibleSidecar(versionId)
    let metadata = validatedSidecars.get(versionId)
    if (!metadata) {
      metadata = await readMetadata(database)
      const compatibility = classifyStrongBibleSidecarMetadata(
        metadata,
        getExpectedSidecar(versionId),
        {
          textRevision: baseMetadata.textRevision ?? '',
          textSha256: baseMetadata.textSha256 ?? '',
        }
      )
      if (compatibility === 'incompatible') {
        return {
          status: 'incompatible',
          baseTextRevision: baseMetadata.textRevision,
          sidecarTextRevision: metadata.textRevision,
        }
      }
      const snapshot = await readStrongBibleSidecarSnapshot(database)
      validateStrongBibleSidecarSnapshot(snapshot, getExpectedSidecar(versionId))
      metadata = snapshot.metadata
      validatedSidecars.set(versionId, metadata)
    }
    if (
      baseMetadata.textRevision !== metadata.textRevision ||
      baseMetadata.textSha256 !== metadata.textSha256
    ) {
      return {
        status: 'incompatible',
        baseTextRevision: baseMetadata.textRevision,
        sidecarTextRevision: metadata.textRevision,
      }
    }
    return {
      status: 'available',
      versionId,
      datasetId: metadata.datasetId,
      textRevision: metadata.textRevision,
      strongRevision: metadata.strongRevision,
    }
  } catch (error) {
    return {
      status: 'corrupt',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export const installStrongBibleSidecar = async (
  versionId: StrongBibleVersionId,
  callbacks: StrongBibleSidecarInstallCallbacks = {}
): Promise<void> => {
  const publication = getStrongBiblePublication(versionId)
  const baseMetadata = await getBibleVersionMetadata(versionId)
  if (!baseMetadata) throw new Error(`STRONG_BIBLE_BASE_MISSING:${versionId}`)
  if (
    baseMetadata.textRevision !== publication.strong.textRevision ||
    baseMetadata.textSha256 !== publication.strong.textSha256
  ) {
    throw new Error(`STRONG_BIBLE_BASE_REVISION_INCOMPATIBLE:${versionId}`)
  }

  const archivePath = `${FileSystem.cacheDirectory}bible-${versionId}-strong-temp.zip`
  const extractionDirectory = `${FileSystem.cacheDirectory}bible-${versionId}-strong-extract/`
  const extractedPath = `${extractionDirectory}${publication.strong.entry}`
  try {
    await downloadWithCdnFallback({
      url: publication.strong.url,
      destinationPath: archivePath,
      downloadOptions: { cache: false },
      onDownloadProgress: callbacks.onDownloadProgress,
      onResumable: callbacks.onResumable,
      isCancelled: callbacks.isCancelled,
      logTag: 'StrongBibleSidecar',
    })
    if (callbacks.isCancelled?.()) throw new Error('CANCELLED')

    await verifyFileSha256(
      archivePath,
      publication.strong.archiveSha256,
      'STRONG_BIBLE_ARCHIVE_CHECKSUM_MISMATCH'
    )
    callbacks.onStatusInserting?.()
    callbacks.onInsertProgress?.(0)
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
    callbacks.onInsertProgress?.(0.1)
    await unzip(toNativeFilePath(archivePath), toNativeFilePath(extractionDirectory), 'UTF-8')
    callbacks.onInsertProgress?.(0.55)
    await verifyFileSha256(
      extractedPath,
      publication.strong.contentSha256,
      'STRONG_BIBLE_CONTENT_CHECKSUM_MISMATCH'
    )
    callbacks.onInsertProgress?.(0.7)
    await verifyExtractedStrongBibleSidecar(versionId, extractionDirectory)
    callbacks.onInsertProgress?.(0.9)
    await activateStrongBibleSidecar(versionId, extractedPath)
    callbacks.onInsertProgress?.(1)
  } finally {
    callbacks.onResumable?.(null)
    await FileSystem.deleteAsync(archivePath, { idempotent: true })
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  }
}

export const removeStrongBibleSidecar = async (versionId: StrongBibleVersionId): Promise<void> => {
  await closeStrongBibleSidecar(versionId)
  await FileSystem.deleteAsync(getStrongBibleSidecarPath(versionId), { idempotent: true })
}

export const loadStrongBibleChapterSpans = async (
  versionId: StrongBibleVersionId,
  book: number,
  chapter: number
): Promise<Record<number, StrongBibleSpan[]>> => {
  const availability = await getStrongBibleSidecarAvailability(versionId)
  if (availability.status !== 'available') {
    throw new Error(`STRONG_BIBLE_SIDECAR_${availability.status.toUpperCase()}:${versionId}`)
  }
  const database = await openStrongBibleSidecar(versionId)
  const rows = await database.getAllAsync<{
    verse: number
    ordinal: number
    startOffset: number
    length: number
    identityOrder: number | null
    kind: number | null
    code: string | null
    primaryStepTokenId: number | null
    sourceOrder: number | null
    extraStepTokenId: number | null
  }>(
    `SELECT v.verse, o.ordinal, o.startOffset, o.length,
            w.identityOrder, c.kind, c.code,
            o.stepTokenId AS primaryStepTokenId,
            e.sourceOrder, e.stepTokenId AS extraStepTokenId
     FROM Verses v
     JOIN WordSpans o ON o.verseId=v.id
     LEFT JOIN WordStrongCodes w
       ON w.verseId=o.verseId AND w.ordinal=o.ordinal
     LEFT JOIN StrongCodes c ON c.id=w.codeId
     LEFT JOIN WordStepTokenExtras e
       ON e.verseId=o.verseId AND e.targetOrdinal=o.ordinal
     WHERE v.bookOrder=? AND v.chapter=? AND o.isAligned=1
     ORDER BY v.verse, o.ordinal, w.identityOrder, e.sourceOrder`,
    [book, chapter]
  )
  const spansByVerse: Record<number, StrongBibleSpan[]> = {}
  const spanKeys = new Map<string, StrongBibleSpan>()
  for (const row of rows) {
    const key = `${row.verse}:${row.ordinal}`
    let span = spanKeys.get(key)
    if (!span) {
      span = {
        ordinal: row.ordinal,
        startOffset: row.startOffset,
        length: row.length,
        stepTokenIds: row.primaryStepTokenId == null ? [] : [row.primaryStepTokenId],
        identities: [],
      }
      spanKeys.set(key, span)
      spansByVerse[row.verse] ??= []
      spansByVerse[row.verse].push(span)
    }
    if (row.extraStepTokenId != null && !span.stepTokenIds?.includes(row.extraStepTokenId)) {
      span.stepTokenIds?.push(row.extraStepTokenId)
    }
    const kind = row.kind == null ? undefined : IDENTITY_KINDS[row.kind]
    if (
      kind &&
      row.code &&
      !span.identities.some(identity => identity.kind === kind && identity.code === row.code)
    ) {
      span.identities.push({
        kind: kind as StrongBibleIdentityKind,
        code: row.code,
      })
    }
  }
  return spansByVerse
}

export const loadReverseInterlinearChapterSpans = async (
  versionId: StrongBibleVersionId,
  book: number,
  chapter: number
): Promise<Record<number, StrongBibleSpan[]>> => {
  const availability = await getStrongBibleSidecarAvailability(versionId)
  if (availability.status !== 'available') {
    throw new Error(`STRONG_BIBLE_SIDECAR_${availability.status.toUpperCase()}:${versionId}`)
  }
  const database = await openStrongBibleSidecar(versionId)
  const rows = await database.getAllAsync<{
    verse: number
    ordinal: number
    startOffset: number
    length: number
    identityOrder: number | null
    kind: number | null
    code: string | null
    primaryStepTokenId: number | null
    sourceOrder: number | null
    extraStepTokenId: number | null
  }>(
    `SELECT v.verse, o.ordinal, o.startOffset, o.length,
            w.identityOrder, c.kind, c.code,
            o.stepTokenId AS primaryStepTokenId,
            e.sourceOrder, e.stepTokenId AS extraStepTokenId
       FROM Verses v
       JOIN WordSpans o ON o.verseId=v.id
       LEFT JOIN WordStrongCodes w
         ON w.verseId=o.verseId AND w.ordinal=o.ordinal
       LEFT JOIN StrongCodes c ON c.id=w.codeId
       LEFT JOIN WordStepTokenExtras e
         ON e.verseId=o.verseId AND e.targetOrdinal=o.ordinal
      WHERE v.bookOrder=? AND v.chapter=? AND o.isAligned=1
      ORDER BY v.verse, o.ordinal, w.identityOrder, e.sourceOrder`,
    [book, chapter]
  )
  const spansByVerse: Record<number, StrongBibleSpan[]> = {}
  const spanKeys = new Map<string, StrongBibleSpan>()
  for (const row of rows) {
    const key = `${row.verse}:${row.ordinal}`
    let span = spanKeys.get(key)
    if (!span) {
      span = {
        ordinal: row.ordinal,
        startOffset: row.startOffset,
        length: row.length,
        stepTokenIds: row.primaryStepTokenId == null ? [] : [row.primaryStepTokenId],
        identities: [],
      }
      spanKeys.set(key, span)
      spansByVerse[row.verse] ??= []
      spansByVerse[row.verse].push(span)
    }
    if (row.extraStepTokenId != null && !span.stepTokenIds?.includes(row.extraStepTokenId)) {
      span.stepTokenIds?.push(row.extraStepTokenId)
    }
    const kind = row.kind == null ? undefined : IDENTITY_KINDS[row.kind]
    if (
      kind &&
      row.code &&
      !span.identities.some(identity => identity.kind === kind && identity.code === row.code)
    ) {
      span.identities.push({
        kind: kind as StrongBibleIdentityKind,
        code: row.code,
      })
    }
  }
  return spansByVerse
}

export const loadStrongBibleVerseSpans = async (
  versionId: StrongBibleVersionId,
  book: number,
  chapter: number,
  verse: number
): Promise<StrongBibleSpan[]> => {
  const spans = await loadStrongBibleChapterSpans(versionId, book, chapter)
  return spans[verse] ?? []
}

export interface StrongBibleVerseCountByBook {
  Livre: number
  versesCountByBook: number
}

export interface StrongBibleOccurrenceLocation {
  Livre: number
  Chapitre: number
  Verset: number
}

export interface StrongBibleOccurrencePage {
  limit?: number
  offset?: number
}

export const loadStrongBibleVerseCountsByBook = async (
  versionId: StrongBibleVersionId,
  referenceBook: number,
  reference: string | number
): Promise<StrongBibleVerseCountByBook[]> => {
  await assertStrongBibleSidecarAvailable(versionId)
  const database = await openStrongBibleSidecar(versionId)
  return database.getAllAsync<StrongBibleVerseCountByBook>(
    `SELECT v.bookOrder AS Livre, COUNT(DISTINCT v.id) AS versesCountByBook
     FROM StrongCodes c
     JOIN WordStrongCodes w ON w.codeId=c.id
     JOIN Verses v ON v.id=w.verseId
     WHERE c.kind=0 AND c.code=?
     GROUP BY v.bookOrder
     ORDER BY v.bookOrder`,
    [toStandardStrongCode(referenceBook, reference)]
  )
}

export const loadStrongBibleOccurrenceLocations = async (
  versionId: StrongBibleVersionId,
  book: number,
  reference: string | number,
  page: StrongBibleOccurrencePage = {}
): Promise<StrongBibleOccurrenceLocation[]> => {
  await assertStrongBibleSidecarAvailable(versionId)
  const database = await openStrongBibleSidecar(versionId)
  return database.getAllAsync<StrongBibleOccurrenceLocation>(
    `SELECT DISTINCT
       v.bookOrder AS Livre,
       v.chapter AS Chapitre,
       v.verse AS Verset
     FROM StrongCodes c
     JOIN WordStrongCodes w ON w.codeId=c.id
     JOIN Verses v ON v.id=w.verseId
     WHERE c.kind=0 AND c.code=? AND v.bookOrder=?
     ORDER BY v.chapter, v.verse
     LIMIT ? OFFSET ?`,
    [toStandardStrongCode(book, reference), book, page.limit ?? -1, Math.max(0, page.offset ?? 0)]
  )
}

const assertStrongBibleSidecarAvailable = async (
  versionId: StrongBibleVersionId
): Promise<void> => {
  const availability = await getStrongBibleSidecarAvailability(versionId)
  if (availability.status !== 'available') {
    throw new Error(`STRONG_BIBLE_SIDECAR_${availability.status.toUpperCase()}:${versionId}`)
  }
}

const toStandardStrongCode = (book: number, reference: string | number): string => {
  const prefix = book <= 39 ? 'H' : 'G'
  return `${prefix}${String(Number(reference)).padStart(4, '0')}`
}

const openStrongBibleSidecar = async (versionId: StrongBibleVersionId): Promise<SQLiteDatabase> => {
  const existing = sidecarDatabases.get(versionId)
  if (existing) return existing
  const directory = getStrongBibleSidecarDirectory()
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
  const database = await openSQLiteDatabase(
    getStrongBibleSidecarFileName(versionId),
    { useNewConnection: true },
    directory
  )
  sidecarDatabases.set(versionId, database)
  return database
}

const closeStrongBibleSidecar = async (versionId: StrongBibleVersionId): Promise<void> => {
  validatedSidecars.delete(versionId)
  const database = sidecarDatabases.get(versionId)
  if (!database) return
  sidecarDatabases.delete(versionId)
  await database.closeAsync()
}

const readMetadata = async (database: SQLiteDatabase): Promise<StrongBibleSidecarMetadata> => {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM ResourceMetadata'
  )
  const metadata = Object.fromEntries(rows.map(({ key, value }) => [key, value]))
  return {
    applicationVersionId: metadata.applicationVersionId ?? '',
    datasetId: metadata.datasetId ?? '',
    textRevision: metadata.textRevision ?? '',
    textSha256: metadata.textSha256 ?? '',
    strongRevision: metadata.strongRevision ?? '',
    schemaVersion: Number(metadata.schemaVersion ?? 0),
    reverseInterlinearSchemaVersion: metadata.reverseInterlinearSchemaVersion
      ? Number(metadata.reverseInterlinearSchemaVersion)
      : undefined,
    reverseInterlinearStepRevision: metadata.reverseInterlinearStepRevision,
    reverseInterlinearStepTextSha256: metadata.reverseInterlinearStepTextSha256,
    reverseInterlinearCompatibleRuntimeSha256s: parseStringArray(
      metadata.reverseInterlinearCompatibleRuntimeSha256s
    ),
  }
}

const verifyExtractedStrongBibleSidecar = async (
  versionId: StrongBibleVersionId,
  directory: string
): Promise<void> => {
  const publication = getStrongBiblePublication(versionId)
  const database = await openSQLiteDatabase(
    publication.strong.entry,
    { useNewConnection: true },
    directory
  )
  try {
    const snapshot = await readStrongBibleSidecarSnapshot(database)
    validateStrongBibleSidecarSnapshot(snapshot, getExpectedSidecar(versionId))
  } finally {
    await database.closeAsync()
  }
}

const readStrongBibleSidecarSnapshot = async (
  database: SQLiteDatabase
): Promise<StrongBibleSidecarSnapshot> => {
  const integrity = await database.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check'
  )
  const metadata = await readMetadata(database)
  const counts = await database.getFirstAsync<StrongBibleSidecarCounts>(
    `SELECT
       (SELECT COUNT(*) FROM Verses) AS verseCount,
       (SELECT COUNT(*) FROM WordSpans) AS occurrenceCount,
       (SELECT COUNT(*) FROM WordSpans WHERE isAligned=0) AS unalignedOccurrenceCount,
       (SELECT COUNT(*) FROM WordStrongCodes) AS identityCount,
       (SELECT COUNT(*) FROM WordSpans WHERE lexemeId IS NOT NULL) AS lexemeAssignmentCount,
       (SELECT COUNT(*) FROM FrenchLexemes) AS lexemeCount`
  )
  const verseColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(Verses)')
  const wordSpanColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(WordSpans)'
  )
  const tableNames = await database.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_schema WHERE type='table'`
  )
  if (!counts) throw new Error('STRONG_BIBLE_COUNT_MISSING')
  return {
    integrity: integrity?.integrity_check ?? '',
    metadata,
    counts,
    verseColumns: verseColumns.map(column => column.name),
    wordSpanColumns: wordSpanColumns.map(column => column.name),
    tableNames: tableNames.map(table => table.name),
  }
}

const parseStringArray = (value?: string): string[] | undefined => {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : undefined
  } catch {
    return undefined
  }
}

const getExpectedSidecar = (versionId: StrongBibleVersionId): ExpectedStrongBibleSidecar => {
  const publication = getStrongBiblePublication(versionId)
  return {
    applicationVersionId: versionId,
    datasetId: publication.datasetId,
    textRevision: publication.strong.textRevision,
    textSha256: publication.strong.textSha256,
    strongRevision: publication.strong.strongRevision,
    schemaVersion: publication.strong.schemaVersion,
    verseCount: publication.strong.verseCount,
    occurrenceCount: publication.strong.occurrenceCount,
    unalignedOccurrenceCount: publication.strong.unalignedOccurrenceCount,
    identityCount: publication.strong.identityCount,
    lexemeAssignmentCount: publication.strong.lexemeAssignmentCount,
    lexemeCount: publication.strong.lexemeCount,
    reverseInterlinearSchemaVersion: publication.strong.reverseInterlinearSchemaVersion,
    reverseInterlinearStepRevision: publication.strong.reverseInterlinearStepRevision,
    reverseInterlinearStepTextSha256: publication.strong.reverseInterlinearStepTextSha256,
    reverseInterlinearCompatibleRuntimeSha256s:
      publication.strong.reverseInterlinearCompatibleRuntimeSha256s,
  }
}

const activateStrongBibleSidecar = async (
  versionId: StrongBibleVersionId,
  extractedPath: string
): Promise<void> => {
  const directory = getStrongBibleSidecarDirectory()
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
  const destinationPath = getStrongBibleSidecarPath(versionId)
  const backupPath = `${destinationPath}.backup`
  await closeStrongBibleSidecar(versionId)
  await FileSystem.deleteAsync(backupPath, { idempotent: true })
  const destinationInfo = await FileSystem.getInfoAsync(destinationPath)
  if (destinationInfo.exists) {
    await FileSystem.moveAsync({ from: destinationPath, to: backupPath })
  }

  try {
    await FileSystem.moveAsync({ from: extractedPath, to: destinationPath })
    await FileSystem.deleteAsync(backupPath, { idempotent: true })
  } catch (error) {
    await FileSystem.deleteAsync(destinationPath, { idempotent: true })
    const backupInfo = await FileSystem.getInfoAsync(backupPath)
    if (backupInfo.exists) {
      await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
    }
    throw error
  }
}
