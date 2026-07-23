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
    noteCount: 2,
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
  noteCount: 2,
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
})
