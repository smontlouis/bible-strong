import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import { getBibleVersionMetadata } from './biblesDb'
import { getSharedSqliteDirPath } from './databaseTypes'
import { downloadWithCdnFallback } from './downloadWithCdnFallback'
import { toNativeFilePath, verifyFileSha256 } from './fileIntegrity'
import { AsyncConnectionRegistry } from './asyncConnectionRegistry'
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
  type StrongBiblePublication,
  type StrongBibleVersionId,
} from './strongBiblePublications'
import type { StrongBibleIdentityKind, StrongBibleSpan } from './canonicalStrongVerse'
import { STRONG_IDENTITY_KINDS } from './strongIdentities'
import { installAtomicResourceFile, restoreOrphanedResourceBackup } from './atomicResourceFile'
import { getStrongBibleConcordanceCandidates } from './strongBibleConcordance'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'

class StrongBibleSidecarMissingError extends Error {}

const strongBibleConnections = new AsyncConnectionRegistry<StrongBibleVersionId, SQLiteDatabase>(
  async versionId => {
    const path = getStrongBibleSidecarPath(versionId)
    await restoreOrphanedResourceBackup(path, `${path}.backup`)
    const file = await FileSystem.getInfoAsync(path)
    if (!file.exists || file.size === 0) throw new StrongBibleSidecarMissingError()

    const directory = getStrongBibleSidecarDirectory()
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    return openSQLiteDatabase(
      getStrongBibleSidecarFileName(versionId),
      { useNewConnection: true },
      directory
    )
  },
  database => database.closeAsync()
)
const validatedSidecars = new Map<StrongBibleVersionId, StrongBibleSidecarMetadata>()
const IDENTITY_KINDS = STRONG_IDENTITY_KINDS

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
      textSha256?: string
      strongRevision: string
    }

export interface StrongBibleSidecarInstallCallbacks {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  onStatusInserting?: () => void
  onInsertProgress?: (progress: number) => void
  isCancelled?: () => boolean
  installationLifecycle?: ResourceInstallationLifecycle
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
  const baseMetadata = await getBibleVersionMetadata(versionId)
  if (!baseMetadata) return { status: 'base-missing' }

  try {
    return await withStrongBibleSidecar(versionId, async database => {
      let metadata = validatedSidecars.get(versionId)
      if (!metadata) {
        metadata = await readMetadata(database)
        const snapshot = await readStrongBibleSidecarSnapshot(database)
        const expected = getExpectedSidecar(versionId, snapshot)
        const compatibility = classifyStrongBibleSidecarMetadata(metadata, expected, {
          textRevision: baseMetadata.textRevision ?? '',
          textSha256: baseMetadata.textSha256 ?? '',
        })
        if (compatibility === 'incompatible') {
          return {
            status: 'incompatible',
            baseTextRevision: baseMetadata.textRevision,
            sidecarTextRevision: metadata.textRevision,
          }
        }
        validateStrongBibleSidecarSnapshot(snapshot, expected)
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
        textSha256: metadata.textSha256,
        strongRevision: metadata.strongRevision,
      }
    })
  } catch (error) {
    if (error instanceof StrongBibleSidecarMissingError) return { status: 'missing' }
    return {
      status: 'corrupt',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export const installStrongBibleSidecar = async (
  versionId: StrongBibleVersionId,
  artifact: StrongBiblePublication['strong'],
  callbacks: StrongBibleSidecarInstallCallbacks = {}
) => {
  const baseMetadata = await getBibleVersionMetadata(versionId)
  if (!baseMetadata) throw new Error(`STRONG_BIBLE_BASE_MISSING:${versionId}`)
  const archivePath = `${FileSystem.cacheDirectory}bible-${versionId}-strong-temp.zip`
  const extractionDirectory = `${FileSystem.cacheDirectory}bible-${versionId}-strong-extract/`
  const extractedPath = `${extractionDirectory}${artifact.entry}`
  try {
    const downloadResult = await downloadWithCdnFallback({
      url: artifact.url,
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
      artifact.archiveSha256,
      `STRONG_BIBLE_ARCHIVE_CHECKSUM_MISMATCH:${versionId}`
    )
    await callbacks.installationLifecycle?.prepare(downloadResult)

    callbacks.onStatusInserting?.()
    callbacks.onInsertProgress?.(0)
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
    callbacks.onInsertProgress?.(0.1)
    await unzip(toNativeFilePath(archivePath), toNativeFilePath(extractionDirectory), 'UTF-8')
    callbacks.onInsertProgress?.(0.55)
    callbacks.onInsertProgress?.(0.7)
    await verifyExtractedStrongBibleSidecar(versionId, extractionDirectory, {
      textRevision: baseMetadata.textRevision ?? '',
      textSha256: baseMetadata.textSha256 ?? '',
    })
    callbacks.onInsertProgress?.(0.9)
    await activateStrongBibleSidecar(versionId, extractedPath, () =>
      callbacks.installationLifecycle?.commit(downloadResult)
    )
    callbacks.onInsertProgress?.(1)
    return downloadResult
  } finally {
    callbacks.onResumable?.(null)
    await FileSystem.deleteAsync(archivePath, { idempotent: true })
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  }
}

export const removeStrongBibleSidecar = async (versionId: StrongBibleVersionId): Promise<void> => {
  await strongBibleConnections.withExclusiveAccess(versionId, async () => {
    validatedSidecars.delete(versionId)
    await FileSystem.deleteAsync(getStrongBibleSidecarPath(versionId), { idempotent: true })
  })
}

type StrongBibleSpanRow = {
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
}

const groupStrongBibleSpanRows = <Row extends StrongBibleSpanRow, GroupKey extends string | number>(
  rows: Row[],
  getGroupKey: (row: Row) => GroupKey
): Map<GroupKey, StrongBibleSpan[]> => {
  const spansByGroup = new Map<GroupKey, StrongBibleSpan[]>()
  const spanKeys = new Map<string, StrongBibleSpan>()
  for (const row of rows) {
    const groupKey = getGroupKey(row)
    const key = `${groupKey}:${row.ordinal}`
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
      const groupSpans = spansByGroup.get(groupKey) ?? []
      groupSpans.push(span)
      spansByGroup.set(groupKey, groupSpans)
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
  return spansByGroup
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
  const rows = await withStrongBibleSidecar(versionId, database =>
    database.getAllAsync<StrongBibleSpanRow>(
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
     WHERE v.bookOrder=? AND v.chapter=? AND (o.isAligned=1 OR o.length=0)
     ORDER BY v.verse, o.ordinal, w.identityOrder, e.sourceOrder`,
      [book, chapter]
    )
  )
  return Object.fromEntries(groupStrongBibleSpanRows(rows, row => row.verse)) as Record<
    number,
    StrongBibleSpan[]
  >
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
  const rows = await withStrongBibleSidecar(versionId, database =>
    database.getAllAsync<{
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
      WHERE v.bookOrder=? AND v.chapter=? AND (o.isAligned=1 OR o.length=0)
      ORDER BY v.verse, o.ordinal, w.identityOrder, e.sourceOrder`,
      [book, chapter]
    )
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

export const loadStrongBibleVersesSpans = async (
  versionId: StrongBibleVersionId,
  locations: StrongBibleOccurrenceLocation[]
): Promise<Record<string, StrongBibleSpan[]>> => {
  if (!locations.length) return {}
  await assertStrongBibleSidecarAvailable(versionId)
  const uniqueLocations = [
    ...new Map(
      locations.map(location => [
        `${location.Livre}-${location.Chapitre}-${location.Verset}`,
        location,
      ])
    ).values(),
  ]
  const locationFilters = uniqueLocations
    .map(() => '(v.bookOrder=? AND v.chapter=? AND v.verse=?)')
    .join(' OR ')
  const parameters = uniqueLocations.flatMap(location => [
    location.Livre,
    location.Chapitre,
    location.Verset,
  ])
  const rows = await withStrongBibleSidecar(versionId, database =>
    database.getAllAsync<StrongBibleSpanRow & { bookOrder: number; chapter: number }>(
      `SELECT v.bookOrder, v.chapter, v.verse,
            o.ordinal, o.startOffset, o.length,
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
      WHERE (${locationFilters}) AND (o.isAligned=1 OR o.length=0)
      ORDER BY v.bookOrder, v.chapter, v.verse, o.ordinal, w.identityOrder, e.sourceOrder`,
      parameters
    )
  )
  return Object.fromEntries(
    groupStrongBibleSpanRows(rows, row => `${row.bookOrder}-${row.chapter}-${row.verse}`)
  )
}

export interface StrongBibleOccurrencePage {
  limit?: number
  offset?: number
  allBooks?: boolean
  lexemeId?: number
}

export interface StrongBibleLemmaStat {
  id: number
  lemma: string
  partOfSpeech: string
  occurrenceCount: number
}

export const loadStrongBibleVerseCountsByBook = async (
  versionId: StrongBibleVersionId,
  referenceBook: number,
  reference: string | number
): Promise<StrongBibleVerseCountByBook[]> => {
  await assertStrongBibleSidecarAvailable(versionId)
  return withStrongBibleSidecar(versionId, async database => {
    const identity = await resolveStrongBibleConcordanceIdentity(database, referenceBook, reference)
    if (!identity) return []
    return database.getAllAsync<StrongBibleVerseCountByBook>(
      `SELECT v.bookOrder AS Livre, COUNT(DISTINCT v.id) AS versesCountByBook
     FROM StrongCodes c
     JOIN WordStrongCodes w ON w.codeId=c.id
     JOIN Verses v ON v.id=w.verseId
     WHERE c.id=?
     GROUP BY v.bookOrder
     ORDER BY v.bookOrder`,
      [identity.id]
    )
  })
}

export const loadStrongBibleOccurrenceLocations = async (
  versionId: StrongBibleVersionId,
  book: number,
  reference: string | number,
  page: StrongBibleOccurrencePage = {}
): Promise<StrongBibleOccurrenceLocation[]> => {
  await assertStrongBibleSidecarAvailable(versionId)
  return withStrongBibleSidecar(versionId, async database => {
    const identity = await resolveStrongBibleConcordanceIdentity(database, book, reference)
    if (!identity) return []
    const filters = ['c.id=?']
    const parameters: number[] = [identity.id]
    if (!page.allBooks) {
      filters.push('v.bookOrder=?')
      parameters.push(book)
    }
    if (page.lexemeId != null) {
      filters.push('s.lexemeId=?')
      parameters.push(page.lexemeId)
    }
    return database.getAllAsync<StrongBibleOccurrenceLocation>(
      `SELECT DISTINCT
       v.bookOrder AS Livre,
       v.chapter AS Chapitre,
       v.verse AS Verset
     FROM StrongCodes c
     JOIN WordStrongCodes w ON w.codeId=c.id
     JOIN WordSpans s ON s.verseId=w.verseId AND s.ordinal=w.ordinal
     JOIN Verses v ON v.id=w.verseId
     WHERE ${filters.join(' AND ')}
     ORDER BY v.bookOrder, v.chapter, v.verse
     LIMIT ? OFFSET ?`,
      [...parameters, page.limit ?? -1, Math.max(0, page.offset ?? 0)]
    )
  })
}

export const loadStrongBibleLemmaStats = async (
  versionId: StrongBibleVersionId,
  book: number,
  reference: string | number
): Promise<StrongBibleLemmaStat[]> => {
  await assertStrongBibleSidecarAvailable(versionId)
  return withStrongBibleSidecar(versionId, async database => {
    const identity = await resolveStrongBibleConcordanceIdentity(database, book, reference)
    if (!identity) return []
    return database.getAllAsync<StrongBibleLemmaStat>(
      `SELECT l.id, l.lemma, l.partOfSpeech, COUNT(DISTINCT s.verseId) AS occurrenceCount
       FROM WordStrongCodes w
       JOIN WordSpans s ON s.verseId=w.verseId AND s.ordinal=w.ordinal
       JOIN FrenchLexemes l ON l.id=s.lexemeId
      WHERE w.codeId=?
      GROUP BY l.id, l.lemma, l.partOfSpeech
      ORDER BY occurrenceCount DESC, l.lemma`,
      [identity.id]
    )
  })
}

const assertStrongBibleSidecarAvailable = async (
  versionId: StrongBibleVersionId
): Promise<void> => {
  const availability = await getStrongBibleSidecarAvailability(versionId)
  if (availability.status !== 'available') {
    throw new Error(`STRONG_BIBLE_SIDECAR_${availability.status.toUpperCase()}:${versionId}`)
  }
}

export type ResolvedStrongBibleIdentity = {
  id: number
  kind: (typeof IDENTITY_KINDS)[number]
  code: string
}

export const resolveStrongBibleConcordanceIdentity = async (
  database: SQLiteDatabase,
  book: number,
  reference: string | number
): Promise<ResolvedStrongBibleIdentity | undefined> => {
  const candidates = getStrongBibleConcordanceCandidates(book, reference)
  for (const candidate of candidates) {
    const row = await database.getFirstAsync<{ id: number; kind: number; code: string }>(
      'SELECT id, kind, code FROM StrongCodes WHERE kind=? AND code=? LIMIT 1',
      [candidate.kind, candidate.code]
    )
    const kind = row ? IDENTITY_KINDS[row.kind] : undefined
    if (row && kind) return { id: row.id, kind, code: row.code }
  }
  return undefined
}

export const getResolvedStrongBibleConcordanceIdentity = async (
  versionId: StrongBibleVersionId,
  book: number,
  reference: string | number
): Promise<ResolvedStrongBibleIdentity | undefined> => {
  await assertStrongBibleSidecarAvailable(versionId)
  return withStrongBibleSidecar(versionId, database =>
    resolveStrongBibleConcordanceIdentity(database, book, reference)
  )
}

const withStrongBibleSidecar = <Result>(
  versionId: StrongBibleVersionId,
  operation: (database: SQLiteDatabase) => Promise<Result>
) => strongBibleConnections.use(versionId, operation)

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
  directory: string,
  baseMetadata: Pick<StrongBibleSidecarMetadata, 'textRevision' | 'textSha256'>
): Promise<void> => {
  const publication = getStrongBiblePublication(versionId)
  const database = await openSQLiteDatabase(
    publication.strong.entry,
    { useNewConnection: true },
    directory
  )
  try {
    const snapshot = await readStrongBibleSidecarSnapshot(database)
    const expected = getExpectedSidecar(versionId, snapshot)
    if (
      classifyStrongBibleSidecarMetadata(snapshot.metadata, expected, baseMetadata) ===
      'incompatible'
    ) {
      throw new Error(`STRONG_BIBLE_BASE_REVISION_INCOMPATIBLE:${versionId}`)
    }
    validateStrongBibleSidecarSnapshot(snapshot, expected)
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
  const requiredTableNames = [
    'Verses',
    'WordSpans',
    'StrongCodes',
    'WordStrongCodes',
    'FrenchLexemes',
    'WordStepTokenExtras',
  ] as const
  const tableColumns = Object.fromEntries(
    await Promise.all(
      requiredTableNames.map(async tableName => {
        const columns = await database.getAllAsync<{ name: string }>(
          `PRAGMA table_info(${tableName})`
        )
        return [tableName, columns.map(column => column.name)] as const
      })
    )
  )
  if (!counts) throw new Error('STRONG_BIBLE_COUNT_MISSING')
  return {
    integrity: integrity?.integrity_check ?? '',
    metadata,
    counts,
    tableColumns,
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

const getExpectedSidecar = (
  versionId: StrongBibleVersionId,
  snapshot: StrongBibleSidecarSnapshot
): ExpectedStrongBibleSidecar => {
  const publication = getStrongBiblePublication(versionId)
  return {
    applicationVersionId: versionId,
    datasetId: publication.datasetId,
    textRevision: snapshot.metadata.textRevision,
    textSha256: snapshot.metadata.textSha256,
    strongRevision: snapshot.metadata.strongRevision,
    schemaVersion: publication.strong.schemaVersion,
    ...snapshot.counts,
    reverseInterlinearSchemaVersion: publication.strong.reverseInterlinearSchemaVersion,
    reverseInterlinearStepRevision: publication.strong.reverseInterlinearStepRevision,
    reverseInterlinearStepTextSha256: publication.strong.reverseInterlinearStepTextSha256,
    reverseInterlinearCompatibleRuntimeSha256s:
      publication.strong.reverseInterlinearCompatibleRuntimeSha256s,
  }
}

const activateStrongBibleSidecar = async (
  versionId: StrongBibleVersionId,
  extractedPath: string,
  beforeCommit?: () => void | Promise<void>
): Promise<void> => {
  const directory = getStrongBibleSidecarDirectory()
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
  const destinationPath = getStrongBibleSidecarPath(versionId)
  await strongBibleConnections.withExclusiveAccess(versionId, async () => {
    validatedSidecars.delete(versionId)
    await installAtomicResourceFile({
      candidatePath: extractedPath,
      destinationPath,
      afterSwap: beforeCommit,
    })
  })
}
