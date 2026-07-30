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
import {
  classifyInterlinearBibleSidecarSnapshot,
  INTERLINEAR_BIBLE_SIDECAR_REQUIRED_TABLE_COLUMNS,
} from './interlinearBibleSidecarValidation'
import { AsyncConnectionRegistry } from './asyncConnectionRegistry'
import { openSQLiteDatabase, type SQLiteDatabase } from './sqlite'
import { installAtomicResourceFile, restoreOrphanedResourceBackup } from './atomicResourceFile'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'

class InterlinearSidecarMissingError extends Error {}

const interlinearConnections = new AsyncConnectionRegistry<ResourceLanguage, SQLiteDatabase>(
  async locale => {
    const path = getInterlinearSidecarPath(locale)
    await restoreOrphanedResourceBackup(path, `${path}.backup`)
    const file = await FileSystem.getInfoAsync(path)
    if (!file.exists || file.size === 0) throw new InterlinearSidecarMissingError()

    const directory = getInterlinearSidecarDirectory()
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    const filename = `bible-bhg-interlinear-${locale}.sqlite`
    return openSQLiteDatabase(filename, { useNewConnection: true }, directory)
  },
  database => database.closeAsync()
)
const validatedSidecars = new Map<ResourceLanguage, { textRevision: string; textSha256: string }>()

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

export interface InterlinearStrongVerseCountByBook {
  Livre: number
  versesCountByBook: number
}

interface InterlinearStrongOccurrenceLocation {
  verseId: number
  Livre: number
  Chapitre: number
  Verset: number
}

export interface InterlinearStrongOccurrence {
  Livre: number
  Chapitre: number
  Verset: number
  tokens: InterlinearToken[]
}

export interface InterlinearStrongOccurrencePage {
  occurrences: InterlinearStrongOccurrence[]
  nextCursor?: string
}

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
  installationLifecycle?: ResourceInstallationLifecycle
}

export const getInterlinearSidecarDirectory = () => `${getSharedSqliteDirPath()}/interlinear-bibles`

export const getInterlinearSidecarPath = (locale: ResourceLanguage) =>
  `${getInterlinearSidecarDirectory()}/bible-bhg-interlinear-${locale}.sqlite`

export const getInterlinearSidecarAvailability = async (
  locale: ResourceLanguage
): Promise<InterlinearSidecarAvailability> => {
  const baseMetadata = await getBibleVersionMetadata('BHG')
  if (!baseMetadata) return { status: 'base-missing' }
  const validated = validatedSidecars.get(locale)
  if (
    validated &&
    validated.textRevision === baseMetadata.textRevision &&
    validated.textSha256 === baseMetadata.textSha256
  ) {
    return { status: 'available', locale, textRevision: validated.textRevision }
  }

  try {
    return await withInterlinearSidecar(locale, async database => {
      const [metadata, tableColumns] = await Promise.all([
        readMetadata(database),
        readTableColumns(database),
      ])
      const artifact = BHG_INTERLINEAR_PUBLICATION.indexes[locale]
      if (
        classifyInterlinearBibleSidecarSnapshot(
          { metadata, tableColumns },
          {
            schemaVersion: artifact.schemaVersion,
            datasetId: BHG_INTERLINEAR_PUBLICATION.datasetId,
            locale,
            textRevision: artifact.textRevision,
            textSha256: artifact.textSha256,
          },
          baseMetadata
        ) !== 'compatible'
      ) {
        validatedSidecars.delete(locale)
        return { status: 'incompatible' }
      }
      const integrity = await database.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check'
      )
      if (integrity?.integrity_check !== 'ok') {
        validatedSidecars.delete(locale)
        return {
          status: 'corrupt',
          reason: integrity?.integrity_check ?? 'integrity-check-missing',
        }
      }
      validatedSidecars.set(locale, {
        textRevision: metadata.textRevision,
        textSha256: metadata.textSha256,
      })
      return {
        status: 'available',
        locale,
        textRevision: metadata.textRevision,
      }
    })
  } catch (error) {
    validatedSidecars.delete(locale)
    if (error instanceof InterlinearSidecarMissingError) return { status: 'missing' }
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
    await callbacks.installationLifecycle?.prepare(downloadResult)
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
      const [metadata, tableColumns, integrity] = await Promise.all([
        readMetadata(candidate),
        readTableColumns(candidate),
        candidate.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check'),
      ])
      if (
        integrity?.integrity_check !== 'ok' ||
        classifyInterlinearBibleSidecarSnapshot(
          { metadata, tableColumns },
          {
            schemaVersion: artifact.schemaVersion,
            datasetId,
            locale,
            textRevision: artifact.textRevision,
            textSha256: artifact.textSha256,
          },
          baseMetadata
        ) !== 'compatible'
      ) {
        throw new Error('INTERLINEAR_SIDECAR_VALIDATION_FAILED')
      }
    } finally {
      await candidate.closeAsync()
    }
    callbacks.onInsertProgress?.(0.8)
    await activateInterlinearSidecar(locale, extractedPath, () =>
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

export const removeInterlinearSidecar = async (locale: ResourceLanguage) => {
  await interlinearConnections.withExclusiveAccess(locale, () => {
    validatedSidecars.delete(locale)
    return FileSystem.deleteAsync(getInterlinearSidecarPath(locale), { idempotent: true })
  })
}

type InterlinearTokenRow = {
  verseId: number
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
}

const loadInterlinearTokenRows = (
  locale: ResourceLanguage,
  where: string,
  parameters: (string | number)[]
) =>
  withInterlinearSidecar(locale, database =>
    loadInterlinearTokenRowsFromDatabase(database, where, parameters)
  )

const loadInterlinearTokenRowsFromDatabase = (
  database: SQLiteDatabase,
  where: string,
  parameters: (string | number)[]
) =>
  database.getAllAsync<InterlinearTokenRow>(
    `SELECT v.id AS verseId, v.verse, t.id AS tokenId, t.readingOrdinal,
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
        WHERE ${where}
        ORDER BY v.id, t.readingOrdinal, s.ordinal`,
    parameters
  )

const groupInterlinearTokenRows = (
  rows: InterlinearTokenRow[],
  keyOf: (row: InterlinearTokenRow) => number
): Record<number, InterlinearToken[]> => {
  const result: Record<number, InterlinearToken[]> = {}
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
      const key = keyOf(row)
      result[key] ??= []
      result[key].push(token)
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

const assertInterlinearSidecarAvailable = async (locale: ResourceLanguage) => {
  const availability = await getInterlinearSidecarAvailability(locale)
  if (availability.status !== 'available') {
    throw new Error(`INTERLINEAR_SIDECAR_${availability.status.toUpperCase()}:BHG:${locale}`)
  }
}

export const loadInterlinearChapterTokens = async (
  _versionId: InterlinearBibleVersionId,
  locale: ResourceLanguage,
  book: number,
  chapter: number
): Promise<InterlinearChapterTokens> => {
  await assertInterlinearSidecarAvailable(locale)
  return groupInterlinearTokenRows(
    await loadInterlinearTokenRows(locale, 'v.bookOrder=? AND v.chapter=?', [book, chapter]),
    row => row.verse
  )
}

export const loadInterlinearVerseTokens = async (
  _versionId: InterlinearBibleVersionId,
  locale: ResourceLanguage,
  book: number,
  chapter: number,
  verse: number
): Promise<InterlinearToken[]> => {
  await assertInterlinearSidecarAvailable(locale)
  const tokensByVerse = groupInterlinearTokenRows(
    await loadInterlinearTokenRows(locale, 'v.bookOrder=? AND v.chapter=? AND v.verse=?', [
      book,
      chapter,
      verse,
    ]),
    row => row.verse
  )
  return tokensByVerse[verse] ?? []
}

export const loadInterlinearStrongVerseCountsByBook = async (
  locale: ResourceLanguage,
  reference: string | number
): Promise<InterlinearStrongVerseCountByBook[]> => {
  return withInterlinearSidecar(locale, database =>
    database.getAllAsync<InterlinearStrongVerseCountByBook>(
      `SELECT v.bookOrder AS Livre, COUNT(*) AS versesCountByBook
       FROM StrongVerseIndex i
       JOIN StrongCodes c ON c.id=i.codeId
       JOIN Verses v ON v.id=i.verseId
      WHERE c.code=?
      GROUP BY v.bookOrder
      ORDER BY v.bookOrder`,
      [String(reference)]
    )
  )
}

const parseStrongOccurrenceCursor = (cursor?: string): number => {
  if (!cursor) return 0
  const match = /^bhg:(\d+)$/.exec(cursor)
  const verseId = Number(match?.[1])
  if (!Number.isInteger(verseId) || verseId < 1) {
    throw new Error('INTERLINEAR_INVALID_CONCORDANCE_CURSOR')
  }
  return verseId
}

export const loadInterlinearStrongOccurrencePage = async (
  locale: ResourceLanguage,
  reference: string | number,
  options: { book?: number; limit?: number; cursor?: string } = {}
): Promise<InterlinearStrongOccurrencePage> => {
  await assertInterlinearSidecarAvailable(locale)
  const afterVerseId = parseStrongOccurrenceCursor(options.cursor)
  const limit = Math.max(1, options.limit ?? 60)
  const bookFilter = options.book == null ? '' : 'AND v.bookOrder=?'
  const parameters = [
    String(reference),
    afterVerseId,
    ...(options.book == null ? [] : [options.book]),
    limit + 1,
  ]
  return withInterlinearSidecar(locale, async database => {
    const locations = await database.getAllAsync<InterlinearStrongOccurrenceLocation>(
      `SELECT v.id AS verseId,
       v.bookOrder AS Livre,
       v.chapter AS Chapitre,
       v.verse AS Verset
       FROM StrongVerseIndex i
       JOIN StrongCodes c ON c.id=i.codeId
       JOIN Verses v ON v.id=i.verseId
      WHERE c.code=? AND i.verseId>?
      ${bookFilter}
      ORDER BY i.verseId
      LIMIT ?`,
      parameters
    )
    const pageLocations = locations.slice(0, limit)
    const verseIds = pageLocations.map(({ verseId }) => verseId)
    const tokensByVerseId = verseIds.length
      ? groupInterlinearTokenRows(
          await loadInterlinearTokenRowsFromDatabase(
            database,
            `v.id IN (${verseIds.map(() => '?').join(', ')})`,
            verseIds
          ),
          row => row.verseId
        )
      : {}
    const lastLocation = pageLocations.at(-1)
    return {
      occurrences: pageLocations.map(({ verseId, ...location }) => ({
        ...location,
        tokens: tokensByVerseId[verseId] ?? [],
      })),
      ...(locations.length > limit && lastLocation
        ? { nextCursor: `bhg:${lastLocation.verseId}` }
        : {}),
    }
  })
}

const withInterlinearSidecar = <Result>(
  locale: ResourceLanguage,
  operation: (database: SQLiteDatabase) => Promise<Result>
) => interlinearConnections.use(locale, operation)

const readMetadata = async (database: SQLiteDatabase) => {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM ResourceMetadata'
  )
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]))
}

const readTableColumns = async (database: SQLiteDatabase) =>
  Object.fromEntries(
    await Promise.all(
      Object.keys(INTERLINEAR_BIBLE_SIDECAR_REQUIRED_TABLE_COLUMNS).map(async tableName => {
        const columns = await database.getAllAsync<{ name: string }>(
          `PRAGMA table_info("${tableName}")`
        )
        return [tableName, columns.map(({ name }) => name)]
      })
    )
  )

const activateInterlinearSidecar = async (
  locale: ResourceLanguage,
  extractedPath: string,
  beforeCommit?: () => void | Promise<void>
) => {
  const destination = getInterlinearSidecarPath(locale)
  await FileSystem.makeDirectoryAsync(getInterlinearSidecarDirectory(), { intermediates: true })
  await interlinearConnections.withExclusiveAccess(locale, () => {
    validatedSidecars.delete(locale)
    return installAtomicResourceFile({
      candidatePath: extractedPath,
      destinationPath: destination,
      afterSwap: beforeCommit,
    })
  })
}
