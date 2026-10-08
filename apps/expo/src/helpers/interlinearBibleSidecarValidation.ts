/**
 * Oldest index schema this reader understands. A reader contract, not a publication pin: newer
 * schemas stay additive (ADR-0034) and are accepted when the tables below are present.
 */
export const INTERLINEAR_BIBLE_SIDECAR_MIN_SCHEMA_VERSION = 5

export interface InterlinearBibleSidecarMetadata {
  schemaVersion?: string
  datasetId?: string
  locale?: string
  textRevision?: string
  textSha256?: string
}

/** What a reader asks of an index, whatever revision is published. */
export interface InterlinearBibleSidecarReaderContract {
  datasetId: string
  locale: string
}

/**
 * - `unsupported`: this reader cannot use the file at all;
 * - `text-mismatch`: a sound index, built for another text than the installed one.
 */
export type InterlinearBibleSidecarCompatibility = 'compatible' | 'unsupported' | 'text-mismatch'

export interface InterlinearBibleSidecarSnapshot {
  metadata: InterlinearBibleSidecarMetadata
  tableColumns: Record<string, string[]>
  indexes: Record<string, string[][]>
}

export const INTERLINEAR_BIBLE_SIDECAR_REQUIRED_TABLE_COLUMNS = {
  Verses: ['id', 'bookOrder', 'chapter', 'verse'],
  Tokens: ['id', 'verseId', 'readingOrdinal', 'startOffset', 'length'],
  Segments: [
    'tokenId',
    'ordinal',
    'startOffset',
    'length',
    'transliterationId',
    'lemmaId',
    'morphologyId',
    'glossId',
    'strongCodeId',
    'eStrongCodeId',
    'dStrongCodeId',
    'uStrongCodeId',
  ],
  Transliterations: ['id', 'value'],
  Lemmas: ['id', 'value'],
  Morphologies: ['id', 'code'],
  Glosses: ['id', 'text'],
  StrongCodes: ['id', 'code'],
  StrongVerseIndex: ['codeId', 'verseId', 'kindMask'],
} as const

const INTERLINEAR_BIBLE_REQUIRED_QUERY_INDEXES = {
  Verses: ['bookOrder', 'chapter', 'verse'],
  StrongCodes: ['code'],
  StrongVerseIndex: ['codeId', 'verseId'],
} as const

/**
 * An index is used on the installed text only when its own metadata names that text. Nothing
 * compiled into the application says which revision is published (ADR-0079).
 */
export const classifyInterlinearBibleSidecarSnapshot = (
  snapshot: InterlinearBibleSidecarSnapshot,
  reader: InterlinearBibleSidecarReaderContract,
  base: Pick<InterlinearBibleSidecarMetadata, 'textRevision' | 'textSha256'>
): InterlinearBibleSidecarCompatibility => {
  const { metadata } = snapshot
  const schemaVersion = Number(metadata.schemaVersion)
  if (
    !Number.isInteger(schemaVersion) ||
    schemaVersion < INTERLINEAR_BIBLE_SIDECAR_MIN_SCHEMA_VERSION ||
    metadata.datasetId !== reader.datasetId ||
    metadata.locale !== reader.locale ||
    !metadata.textRevision ||
    !metadata.textSha256
  ) {
    return 'unsupported'
  }

  for (const [tableName, requiredColumns] of Object.entries(
    INTERLINEAR_BIBLE_SIDECAR_REQUIRED_TABLE_COLUMNS
  )) {
    const availableColumns = snapshot.tableColumns[tableName] ?? []
    if (requiredColumns.some(columnName => !availableColumns.includes(columnName))) {
      return 'unsupported'
    }
  }

  for (const [tableName, requiredColumns] of Object.entries(
    INTERLINEAR_BIBLE_REQUIRED_QUERY_INDEXES
  )) {
    const hasPrefix = (snapshot.indexes[tableName] ?? []).some(
      columns =>
        columns.length >= requiredColumns.length &&
        requiredColumns.every((columnName, index) => columns[index] === columnName)
    )
    if (!hasPrefix) return 'unsupported'
  }

  return metadata.textRevision === base.textRevision && metadata.textSha256 === base.textSha256
    ? 'compatible'
    : 'text-mismatch'
}
