import {
  classifyInterlinearBibleSidecarSnapshot,
  INTERLINEAR_BIBLE_SIDECAR_MIN_SCHEMA_VERSION,
} from '../interlinearBibleSidecarValidation'

const reader = { datasetId: 'STEP', locale: 'en' }
const installedText = {
  textRevision: 'bhg-803c482ed06005693547',
  textSha256: '803c482ed06005693547f9ea04a2dcbec4718c1d97ab0c531d60600e4c3a9d8f',
}
const nextText = {
  textRevision: 'bhg-e15bd9f0f1a91140579c',
  textSha256: 'e15bd9f0f1a91140579c9eb9c8f4e173b8a4df361859758e0fe252ef55edc107',
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
  StrongVerseIndex: ['codeId', 'verseId', 'kindMask'],
}

const indexes = {
  Verses: [['bookOrder', 'chapter', 'verse']],
  StrongCodes: [['code']],
  StrongVerseIndex: [['codeId', 'verseId']],
}

const metadata = { ...reader, ...installedText, schemaVersion: '5' }

const classify = ({
  sidecar = metadata,
  columns = tableColumns,
  base = installedText,
}: {
  sidecar?: Record<string, string | undefined>
  columns?: Record<string, string[]>
  base?: { textRevision?: string; textSha256?: string }
} = {}) =>
  classifyInterlinearBibleSidecarSnapshot(
    { metadata: sidecar, tableColumns: columns, indexes },
    reader,
    base
  )

describe('classifyInterlinearBibleSidecarSnapshot', () => {
  it('accepts an index whose own metadata names the installed text', () => {
    expect(INTERLINEAR_BIBLE_SIDECAR_MIN_SCHEMA_VERSION).toBe(5)
    expect(classify()).toBe('compatible')
  })

  it('accepts a republished text and index pair no application release knew of', () => {
    expect(classify({ sidecar: { ...metadata, ...nextText }, base: nextText })).toBe('compatible')
  })

  it.each([
    ['an index built for the next text over the installed one', nextText, installedText],
    ['the installed index once the text was updated', installedText, nextText],
    ['a text installed without any revision', installedText, {}],
    [
      'a text of the same revision label but another content',
      installedText,
      { ...installedText, textSha256: '0'.repeat(64) },
    ],
  ])('never matches %s', (_label, indexText, base) => {
    expect(classify({ sidecar: { ...metadata, ...indexText }, base })).toBe('text-mismatch')
  })

  it('accepts a newer additive schema', () => {
    expect(classify({ sidecar: { ...metadata, schemaVersion: '6' } })).toBe('compatible')
  })

  it.each(['4', '3', '1.5', 'not-a-version'])(
    'rejects unsupported sidecar schema version %s',
    schemaVersion => {
      expect(classify({ sidecar: { ...metadata, schemaVersion } })).toBe('unsupported')
    }
  )

  it.each([
    ['another dataset', { datasetId: 'OTHER' }],
    ['another gloss language', { locale: 'fr' }],
    ['no text revision', { textRevision: undefined }],
    ['no text hash', { textSha256: undefined }],
  ])('rejects an index declaring %s', (_label, patch) => {
    expect(classify({ sidecar: { ...metadata, ...patch } })).toBe('unsupported')
  })

  it('rejects a sidecar without the Strong occurrence cursor index', () => {
    expect(
      classifyInterlinearBibleSidecarSnapshot(
        { metadata, tableColumns, indexes: { ...indexes, StrongVerseIndex: [] } },
        reader,
        installedText
      )
    ).toBe('unsupported')
  })

  it('rejects a newer sidecar missing a required runtime column', () => {
    expect(
      classify({
        columns: {
          ...tableColumns,
          Segments: tableColumns.Segments.filter(column => column !== 'glossId'),
        },
      })
    ).toBe('unsupported')
  })
})
