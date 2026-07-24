export interface StrongBibleSidecarMetadata {
  applicationVersionId: string
  datasetId: string
  textRevision: string
  textSha256: string
  strongRevision: string
  schemaVersion: number
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
    metadata.schemaVersion !== expected.schemaVersion
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
