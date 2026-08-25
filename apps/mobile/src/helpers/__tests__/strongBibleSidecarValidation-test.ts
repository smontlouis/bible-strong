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
  tableColumns: {
    Verses: ['id', 'bookOrder', 'chapter', 'verse'],
    WordSpans: ['verseId', 'ordinal', 'startOffset', 'length', 'isAligned', 'lexemeId'],
    StrongCodes: ['id', 'kind', 'code'],
    WordStrongCodes: ['verseId', 'ordinal', 'identityOrder', 'codeId'],
    FrenchLexemes: ['id', 'lemma', 'partOfSpeech'],
  },
  indexes: {
    Verses: [['bookOrder', 'chapter', 'verse']],
    StrongCodes: [['kind', 'code']],
    WordStrongCodes: [['codeId', 'verseId', 'ordinal']],
  },
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

  it('rejects a sidecar without the concordance keyset indexes', () => {
    expect(() =>
      validateStrongBibleSidecarSnapshot(
        { ...validSnapshot, indexes: { ...validSnapshot.indexes, WordStrongCodes: [] } },
        expected
      )
    ).toThrow('STRONG_BIBLE_INDEX_MISSING:WordStrongCodes(codeId,verseId,ordinal)')
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
        tableColumns: {
          ...validSnapshot.tableColumns,
          Verses: [...validSnapshot.tableColumns.Verses, 'canonicalText'],
        },
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

  it('accepts a newer additive sidecar schema', () => {
    const additiveSnapshot = {
      ...validSnapshot,
      metadata: {
        ...validSnapshot.metadata,
        schemaVersion: expected.schemaVersion + 1,
      },
    }

    expect(
      classifyStrongBibleSidecarMetadata(additiveSnapshot.metadata, expected, {
        textRevision: 'text-revision',
        textSha256: 'text-sha',
      })
    ).toBe('compatible')
    expect(() => validateStrongBibleSidecarSnapshot(additiveSnapshot, expected)).not.toThrow()
  })

  it('rejects a sidecar older than the minimum supported schema', () => {
    const newerMinimum = {
      ...expected,
      schemaVersion: validSnapshot.metadata.schemaVersion + 1,
    }

    expect(
      classifyStrongBibleSidecarMetadata(validSnapshot.metadata, newerMinimum, {
        textRevision: 'text-revision',
        textSha256: 'text-sha',
      })
    ).toBe('incompatible')
    expect(() => validateStrongBibleSidecarSnapshot(validSnapshot, newerMinimum)).toThrow(
      'STRONG_BIBLE_SCHEMA_UNSUPPORTED:schemaVersion'
    )
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'rejects malformed sidecar schema version %s',
    schemaVersion => {
      const malformedSnapshot = {
        ...validSnapshot,
        metadata: { ...validSnapshot.metadata, schemaVersion },
      }

      expect(
        classifyStrongBibleSidecarMetadata(malformedSnapshot.metadata, expected, {
          textRevision: 'text-revision',
          textSha256: 'text-sha',
        })
      ).toBe('incompatible')
      expect(() => validateStrongBibleSidecarSnapshot(malformedSnapshot, expected)).toThrow(
        'STRONG_BIBLE_SCHEMA_UNSUPPORTED:schemaVersion'
      )
    }
  )

  it('rejects an additive sidecar missing a required runtime column', () => {
    const incompleteSnapshot = {
      ...validSnapshot,
      metadata: {
        ...validSnapshot.metadata,
        schemaVersion: expected.schemaVersion + 1,
      },
      tableColumns: {
        ...validSnapshot.tableColumns,
        StrongCodes: ['id', 'code'],
      },
    }

    expect(() => validateStrongBibleSidecarSnapshot(incompleteSnapshot, expected)).toThrow(
      'STRONG_BIBLE_SCHEMA_MISSING:StrongCodes.kind'
    )
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

  it('accepts additive reverse-interlinear schema and runtime updates', () => {
    const reverseSnapshot = {
      ...validSnapshot,
      metadata: {
        ...validSnapshot.metadata,
        schemaVersion: 5,
        reverseInterlinearSchemaVersion: 3,
        reverseInterlinearStepRevision: 'bhg-step-revision',
        reverseInterlinearStepTextSha256: 'bhg-step-text-sha',
        reverseInterlinearCompatibleRuntimeSha256s: [
          'runtime-fr',
          'runtime-en',
          'runtime-added-later',
        ],
      },
      tableColumns: {
        ...validSnapshot.tableColumns,
        WordSpans: [...validSnapshot.tableColumns.WordSpans, 'stepTokenId'],
        WordStepTokenExtras: ['verseId', 'targetOrdinal', 'sourceOrder', 'stepTokenId'],
      },
    }
    const reverseExpected = {
      ...expected,
      schemaVersion: 4,
      reverseInterlinearSchemaVersion: 2,
      reverseInterlinearStepRevision: 'bhg-step-revision',
      reverseInterlinearStepTextSha256: 'bhg-step-text-sha',
      reverseInterlinearCompatibleRuntimeSha256s: ['runtime-fr', 'runtime-en'],
    }

    expect(
      classifyStrongBibleSidecarMetadata(reverseSnapshot.metadata, reverseExpected, {
        textRevision: 'text-revision',
        textSha256: 'text-sha',
      })
    ).toBe('compatible')
    expect(() => validateStrongBibleSidecarSnapshot(reverseSnapshot, reverseExpected)).not.toThrow()
  })

  it('requires compact reverse-interlinear pointers and the supported STEP runtime contract', () => {
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
      tableColumns: {
        ...validSnapshot.tableColumns,
        WordSpans: [...validSnapshot.tableColumns.WordSpans, 'stepTokenId'],
        WordStepTokenExtras: ['verseId', 'targetOrdinal', 'sourceOrder', 'stepTokenId'],
      },
    }
    const reverseExpected = {
      ...expected,
      schemaVersion: 4,
      reverseInterlinearSchemaVersion: 2,
      reverseInterlinearStepRevision: 'bhg-step-revision',
      reverseInterlinearStepTextSha256: 'bhg-step-text-sha',
      reverseInterlinearCompatibleRuntimeSha256s: ['runtime-fr', 'runtime-en'],
    }

    expect(() =>
      validateStrongBibleSidecarSnapshot(
        {
          ...reverseSnapshot,
          tableColumns: {
            ...reverseSnapshot.tableColumns,
            WordSpans: reverseSnapshot.tableColumns.WordSpans.filter(
              column => column !== 'stepTokenId'
            ),
          },
        },
        reverseExpected
      )
    ).toThrow('STRONG_BIBLE_SCHEMA_MISSING:WordSpans.stepTokenId')
    expect(() =>
      validateStrongBibleSidecarSnapshot(
        {
          ...reverseSnapshot,
          metadata: {
            ...reverseSnapshot.metadata,
            reverseInterlinearSchemaVersion: 1,
          },
        },
        reverseExpected
      )
    ).toThrow('STRONG_BIBLE_METADATA_MISMATCH:reverseInterlinear')
    expect(() =>
      validateStrongBibleSidecarSnapshot(
        {
          ...reverseSnapshot,
          metadata: {
            ...reverseSnapshot.metadata,
            reverseInterlinearStepRevision: 'another-step-revision',
          },
        },
        reverseExpected
      )
    ).toThrow('STRONG_BIBLE_METADATA_MISMATCH:reverseInterlinear')
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
