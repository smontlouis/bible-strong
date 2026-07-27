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
  verseColumns: string[]
  wordSpanColumns?: string[]
  tableNames?: string[]
}

export type ExpectedStrongBibleSidecar = StrongBibleSidecarMetadata & StrongBibleSidecarCounts

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
    metadata.schemaVersion !== expected.schemaVersion ||
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
    'schemaVersion',
  ] as const) {
    if (snapshot.metadata[key] !== expected[key]) {
      throw new Error(`STRONG_BIBLE_METADATA_MISMATCH:${key}`)
    }
  }

  if (!matchesReverseInterlinearMetadata(snapshot.metadata, expected)) {
    throw new Error('STRONG_BIBLE_METADATA_MISMATCH:reverseInterlinear')
  }

  if (
    expected.reverseInterlinearSchemaVersion != null &&
    (!snapshot.wordSpanColumns?.includes('stepTokenId') ||
      !snapshot.tableNames?.includes('WordStepTokenExtras'))
  ) {
    throw new Error('STRONG_BIBLE_REVERSE_INTERLINEAR_SCHEMA_MISSING')
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

  if (
    snapshot.verseColumns.includes('canonicalText') ||
    snapshot.verseColumns.includes('markupJson')
  ) {
    throw new Error('STRONG_BIBLE_DUPLICATED_TEXT')
  }
}

const matchesReverseInterlinearMetadata = (
  metadata: StrongBibleSidecarMetadata,
  expected: ExpectedStrongBibleSidecar
): boolean => {
  if (expected.reverseInterlinearSchemaVersion == null) return true
  return (
    metadata.reverseInterlinearSchemaVersion === expected.reverseInterlinearSchemaVersion &&
    metadata.reverseInterlinearStepRevision === expected.reverseInterlinearStepRevision &&
    metadata.reverseInterlinearStepTextSha256 === expected.reverseInterlinearStepTextSha256 &&
    JSON.stringify(metadata.reverseInterlinearCompatibleRuntimeSha256s ?? []) ===
      JSON.stringify(expected.reverseInterlinearCompatibleRuntimeSha256s ?? [])
  )
}
