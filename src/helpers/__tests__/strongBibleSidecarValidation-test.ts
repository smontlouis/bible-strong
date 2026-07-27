import {
  classifyStrongBibleSidecarMetadata,
  validateStrongBibleSidecarSnapshot,
} from '../strongBibleSidecarValidation'

const validSnapshot = {
  integrity: 'ok',
  metadata: {
    applicationVersionId: 'DBY',
    datasetId: 'DBY',
    textRevision: 'text-revision',
    textSha256: 'text-sha',
    strongRevision: 'strong-revision',
    schemaVersion: 1,
  },
  counts: {
    verseCount: 10,
    occurrenceCount: 20,
    unalignedOccurrenceCount: 1,
    identityCount: 30,
    lexemeAssignmentCount: 20,
    lexemeCount: 8,
  },
  verseColumns: ['id', 'bookOrder', 'chapter', 'verse'],
}

const expected = {
  applicationVersionId: 'DBY',
  datasetId: 'DBY',
  textRevision: 'text-revision',
  textSha256: 'text-sha',
  strongRevision: 'strong-revision',
  schemaVersion: 1,
  verseCount: 10,
  occurrenceCount: 20,
  unalignedOccurrenceCount: 1,
  identityCount: 30,
  lexemeAssignmentCount: 20,
  lexemeCount: 8,
}

describe('Strong Bible sidecar validation', () => {
  it('accepts a complete matching snapshot', () => {
    expect(() => validateStrongBibleSidecarSnapshot(validSnapshot, expected)).not.toThrow()
  })

  it.each([
    [{ ...validSnapshot, integrity: 'corrupt' }, 'STRONG_BIBLE_INTEGRITY_FAILED'],
    [
      {
        ...validSnapshot,
        metadata: { ...validSnapshot.metadata, datasetId: 'LSG' },
      },
      'STRONG_BIBLE_METADATA_MISMATCH',
    ],
    [
      {
        ...validSnapshot,
        counts: { ...validSnapshot.counts, occurrenceCount: 19 },
      },
      'STRONG_BIBLE_COUNT_MISMATCH',
    ],
    [
      {
        ...validSnapshot,
        verseColumns: [...validSnapshot.verseColumns, 'canonicalText'],
      },
      'STRONG_BIBLE_DUPLICATED_TEXT',
    ],
  ])('rejects an invalid installed snapshot', (snapshot, message) => {
    expect(() => validateStrongBibleSidecarSnapshot(snapshot, expected)).toThrow(message)
  })

  it('classifies older text or Strong revisions as incompatible rather than corrupt', () => {
    const base = { textRevision: 'text-revision', textSha256: 'text-sha' }

    expect(
      classifyStrongBibleSidecarMetadata(
        { ...validSnapshot.metadata, textRevision: 'older-text' },
        expected,
        base
      )
    ).toBe('incompatible')
    expect(
      classifyStrongBibleSidecarMetadata(
        { ...validSnapshot.metadata, strongRevision: 'older-strong' },
        expected,
        base
      )
    ).toBe('incompatible')
  })

  it('rejects a sidecar carrying another Bible identity', () => {
    expect(() =>
      classifyStrongBibleSidecarMetadata(
        { ...validSnapshot.metadata, datasetId: 'LSG' },
        expected,
        { textRevision: 'text-revision', textSha256: 'text-sha' }
      )
    ).toThrow('STRONG_BIBLE_METADATA_MISMATCH:datasetId')
  })

  it('requires compact reverse-interlinear pointers and the exact STEP runtime contract', () => {
    const reverseSnapshot = {
      ...validSnapshot,
      metadata: {
        ...validSnapshot.metadata,
        schemaVersion: 4,
        reverseInterlinearSchemaVersion: 2,
        reverseInterlinearStepRevision: 'bhg-step-revision',
        reverseInterlinearStepTextSha256: 'bhg-step-text-sha',
        reverseInterlinearCompatibleRuntimeSha256s: ['runtime-fr', 'runtime-en'],
      },
      wordSpanColumns: ['verseId', 'ordinal', 'stepTokenId'],
      tableNames: ['WordSpans', 'WordStepTokenExtras'],
    }
    const reverseExpected = {
      ...expected,
      schemaVersion: 4,
      reverseInterlinearSchemaVersion: 2,
      reverseInterlinearStepRevision: 'bhg-step-revision',
      reverseInterlinearStepTextSha256: 'bhg-step-text-sha',
      reverseInterlinearCompatibleRuntimeSha256s: ['runtime-fr', 'runtime-en'],
    }

    expect(() => validateStrongBibleSidecarSnapshot(reverseSnapshot, reverseExpected)).not.toThrow()
    expect(() =>
      validateStrongBibleSidecarSnapshot(
        {
          ...reverseSnapshot,
          wordSpanColumns: ['verseId', 'ordinal'],
        },
        reverseExpected
      )
    ).toThrow('STRONG_BIBLE_REVERSE_INTERLINEAR_SCHEMA_MISSING')
    expect(() =>
      validateStrongBibleSidecarSnapshot(
        {
          ...reverseSnapshot,
          metadata: {
            ...reverseSnapshot.metadata,
            reverseInterlinearCompatibleRuntimeSha256s: ['another-runtime'],
          },
        },
        reverseExpected
      )
    ).toThrow('STRONG_BIBLE_METADATA_MISMATCH:reverseInterlinear')
  })
})
