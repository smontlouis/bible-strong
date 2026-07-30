import { classifyInterlinearBibleSidecarSnapshot } from '../interlinearBibleSidecarValidation'

const expected = {
  schemaVersion: 3,
  datasetId: 'STEP',
  locale: 'en',
  textRevision: 'bhg-text-revision',
  textSha256: 'bhg-text-sha',
}

const tableColumns = {
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
}

const classify = (schemaVersion: string, columns: Record<string, string[]> = tableColumns) =>
  classifyInterlinearBibleSidecarSnapshot(
    {
      metadata: { ...expected, schemaVersion },
      tableColumns: columns,
    },
    expected,
    {
      textRevision: expected.textRevision,
      textSha256: expected.textSha256,
    }
  )

describe('classifyInterlinearBibleSidecarSnapshot', () => {
  it('accepts a newer additive sidecar schema', () => {
    expect(classify('5')).toBe('compatible')
  })

  it.each(['2', '1.5', 'not-a-version'])(
    'rejects unsupported sidecar schema version %s',
    schemaVersion => {
      expect(classify(schemaVersion)).toBe('incompatible')
    }
  )

  it('rejects a newer sidecar missing a required runtime column', () => {
    expect(
      classify('5', {
        ...tableColumns,
        Segments: tableColumns.Segments.filter(column => column !== 'glossId'),
      })
    ).toBe('incompatible')
  })
})
