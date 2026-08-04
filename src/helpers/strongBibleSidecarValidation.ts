export interface StrongBibleSidecarMetadata {
  applicationVersionId: string
  datasetId: string
  textRevision: string
  textSha256: string
  strongRevision: string
  schemaVersion: number
  reverseInterlinearSchemaVersion?: number
  reverseInterlinearStepRevision?: string
  reverseInterlinearStepTextSha256?: string
  reverseInterlinearCompatibleRuntimeSha256s?: string[]
}

export interface StrongBibleSidecarCounts {
  verseCount: number
  occurrenceCount: number
  unalignedOccurrenceCount: number
  identityCount: number
  lexemeAssignmentCount: number
  lexemeCount: number
}

export interface StrongBibleSidecarSnapshot {
  integrity: string
  metadata: StrongBibleSidecarMetadata
  counts: StrongBibleSidecarCounts
  tableColumns: Record<string, string[]>
}

export type ExpectedStrongBibleSidecar = StrongBibleSidecarMetadata & StrongBibleSidecarCounts

const REQUIRED_TABLE_COLUMNS = {
  Verses: ['id', 'bookOrder', 'chapter', 'verse'],
  WordSpans: ['verseId', 'ordinal', 'startOffset', 'length', 'isAligned', 'lexemeId'],
  StrongCodes: ['id', 'kind', 'code'],
  WordStrongCodes: ['verseId', 'ordinal', 'identityOrder', 'codeId'],
  FrenchLexemes: ['id', 'lemma', 'partOfSpeech'],
} as const

const REQUIRED_REVERSE_INTERLINEAR_TABLE_COLUMNS = {
  WordSpans: ['stepTokenId'],
  WordStepTokenExtras: ['verseId', 'targetOrdinal', 'sourceOrder', 'stepTokenId'],
} as const

export const classifyStrongBibleSidecarMetadata = (
  metadata: StrongBibleSidecarMetadata,
  expected: ExpectedStrongBibleSidecar,
  base: Pick<StrongBibleSidecarMetadata, 'textRevision' | 'textSha256'>
): 'compatible' | 'incompatible' => {
  for (const key of ['applicationVersionId', 'datasetId'] as const) {
    if (metadata[key] !== expected[key]) {
      throw new Error(`STRONG_BIBLE_METADATA_MISMATCH:${key}`)
    }
  }

  if (
    metadata.textRevision !== base.textRevision ||
    metadata.textSha256 !== base.textSha256 ||
    metadata.textRevision !== expected.textRevision ||
    metadata.textSha256 !== expected.textSha256 ||
    metadata.strongRevision !== expected.strongRevision ||
    !isSupportedSchemaVersion(metadata.schemaVersion, expected.schemaVersion) ||
    !matchesReverseInterlinearMetadata(metadata, expected)
  ) {
    return 'incompatible'
  }

  return 'compatible'
}

export const validateStrongBibleSidecarSnapshot = (
  snapshot: StrongBibleSidecarSnapshot,
  expected: ExpectedStrongBibleSidecar
): void => {
  if (snapshot.integrity !== 'ok') {
    throw new Error(`STRONG_BIBLE_INTEGRITY_FAILED:${snapshot.integrity}`)
  }

  for (const key of [
    'applicationVersionId',
    'datasetId',
    'textRevision',
    'textSha256',
    'strongRevision',
  ] as const) {
    if (snapshot.metadata[key] !== expected[key]) {
      throw new Error(`STRONG_BIBLE_METADATA_MISMATCH:${key}`)
    }
  }

  if (!isSupportedSchemaVersion(snapshot.metadata.schemaVersion, expected.schemaVersion)) {
    throw new Error('STRONG_BIBLE_SCHEMA_UNSUPPORTED:schemaVersion')
  }

  if (!matchesReverseInterlinearMetadata(snapshot.metadata, expected)) {
    throw new Error('STRONG_BIBLE_METADATA_MISMATCH:reverseInterlinear')
  }

  validateRequiredTableColumns(snapshot.tableColumns, REQUIRED_TABLE_COLUMNS)
  if (expected.reverseInterlinearSchemaVersion != null) {
    validateRequiredTableColumns(snapshot.tableColumns, REQUIRED_REVERSE_INTERLINEAR_TABLE_COLUMNS)
  }

  for (const key of [
    'verseCount',
    'occurrenceCount',
    'unalignedOccurrenceCount',
    'identityCount',
    'lexemeAssignmentCount',
    'lexemeCount',
  ] as const) {
    if (snapshot.counts[key] !== expected[key]) {
      throw new Error(`STRONG_BIBLE_COUNT_MISMATCH:${key}`)
    }
  }

  const verseColumns = snapshot.tableColumns.Verses ?? []
  if (verseColumns.includes('canonicalText') || verseColumns.includes('markupJson')) {
    throw new Error('STRONG_BIBLE_DUPLICATED_TEXT')
  }
}

const validateRequiredTableColumns = (
  tableColumns: Record<string, string[]>,
  requiredTableColumns: Record<string, readonly string[]>
): void => {
  for (const [tableName, requiredColumns] of Object.entries(requiredTableColumns)) {
    const availableColumns = tableColumns[tableName] ?? []
    for (const columnName of requiredColumns) {
      if (!availableColumns.includes(columnName)) {
        throw new Error(`STRONG_BIBLE_SCHEMA_MISSING:${tableName}.${columnName}`)
      }
    }
  }
}

const isSupportedSchemaVersion = (version: number, minimumVersion: number): boolean =>
  Number.isInteger(version) && version >= minimumVersion

const matchesReverseInterlinearMetadata = (
  metadata: StrongBibleSidecarMetadata,
  expected: ExpectedStrongBibleSidecar
): boolean => {
  if (expected.reverseInterlinearSchemaVersion == null) return true
  const compatibleRuntimeSha256s = new Set(
    metadata.reverseInterlinearCompatibleRuntimeSha256s ?? []
  )
  return (
    isSupportedSchemaVersion(
      metadata.reverseInterlinearSchemaVersion ?? Number.NaN,
      expected.reverseInterlinearSchemaVersion
    ) &&
    metadata.reverseInterlinearStepRevision === expected.reverseInterlinearStepRevision &&
    metadata.reverseInterlinearStepTextSha256 === expected.reverseInterlinearStepTextSha256 &&
    (expected.reverseInterlinearCompatibleRuntimeSha256s ?? []).every(sha256 =>
      compatibleRuntimeSha256s.has(sha256)
    )
  )
}
