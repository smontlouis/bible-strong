export interface InterlinearBibleSidecarMetadata {
  schemaVersion?: string
  datasetId?: string
  locale?: string
  textRevision?: string
  textSha256?: string
}

export interface ExpectedInterlinearBibleSidecarMetadata {
  schemaVersion: number
  datasetId: string
  locale: string
  textRevision: string
  textSha256: string
}

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

export const classifyInterlinearBibleSidecarSnapshot = (
  snapshot: InterlinearBibleSidecarSnapshot,
  expected: ExpectedInterlinearBibleSidecarMetadata,
  base: Pick<InterlinearBibleSidecarMetadata, 'textRevision' | 'textSha256'>
): 'compatible' | 'incompatible' => {
  const { metadata } = snapshot
  const schemaVersion = Number(metadata.schemaVersion)
  if (
    !Number.isInteger(schemaVersion) ||
    schemaVersion < expected.schemaVersion ||
    metadata.datasetId !== expected.datasetId ||
    metadata.locale !== expected.locale ||
    metadata.textRevision !== expected.textRevision ||
    metadata.textSha256 !== expected.textSha256 ||
    metadata.textRevision !== base.textRevision ||
    metadata.textSha256 !== base.textSha256
  ) {
    return 'incompatible'
  }

  for (const [tableName, requiredColumns] of Object.entries(
    INTERLINEAR_BIBLE_SIDECAR_REQUIRED_TABLE_COLUMNS
  )) {
    const availableColumns = snapshot.tableColumns[tableName] ?? []
    if (requiredColumns.some(columnName => !availableColumns.includes(columnName))) {
      return 'incompatible'
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
    if (!hasPrefix) return 'incompatible'
  }

  return 'compatible'
}
