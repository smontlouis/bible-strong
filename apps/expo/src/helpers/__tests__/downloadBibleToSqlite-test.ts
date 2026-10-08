/* eslint-disable import/first */

const mockFiles = new Map<string, string>()
const mockInsertBibleVersion = jest.fn()
const mockRemoveLegacyBibleSideFiles = jest.fn()
const mockClearLegacyBibleSideFileCaches = jest.fn()

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(async (path: string) => ({
    exists: mockFiles.has(path),
    isDirectory: false,
    uri: path,
  })),
  readAsStringAsync: jest.fn(async (path: string) => mockFiles.get(path)),
  deleteAsync: jest.fn(async (path: string) => {
    mockFiles.delete(path)
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    mockFiles.set(to, mockFiles.get(from) ?? '')
    mockFiles.delete(from)
  }),
  makeDirectoryAsync: jest.fn(),
}))
jest.mock('~helpers/biblesDb', () => ({
  openBiblesDb: jest.fn(),
  getMultipleVerses: jest.fn(async () => ({})),
  insertBibleVersion: (...args: unknown[]) => mockInsertBibleVersion(...args),
}))
jest.mock('~helpers/downloadResourceArtifact', () => ({
  downloadResourceArtifact: jest.fn(async () => ({
    archive: { kind: 'plain', url: 'https://example.test/nbs.zip', archiveSha256: 'a' },
    publication: { revision: 'nbs-r2', size: 1 },
  })),
}))
jest.mock('~redux/modules/user', () => ({ realignWordAnnotationsAction: jest.fn() }))
jest.mock('~redux/store', () => ({
  store: { getState: () => ({ user: { bible: { wordAnnotations: {} } } }), dispatch: jest.fn() },
  persistor: { flush: jest.fn() },
}))
jest.mock('../annotationMigrationJournal', () => ({
  clearAnnotationMigrationJournal: jest.fn(),
  persistAnnotationMigrationJournal: jest.fn(),
}))
jest.mock('../fileIntegrity', () => ({
  getFileSha256: jest.fn(async () => 'b'.repeat(64)),
  toNativeFilePath: (path: string) => path,
  verifyFileSha256: jest.fn(),
}))
jest.mock('../offlineArchiveSource', () => ({ unzipOfflineArchive: jest.fn() }))
jest.mock('../bibleResourceValidation', () => ({
  validateCanonicalBibleResourceIdentity: jest.fn(),
  validatePericopeResource: jest.fn(),
  validateRedWordsResource: jest.fn(),
}))
const mockWarn = jest.fn()
jest.mock('../agentObservability', () => ({
  appLogger: { captureError: jest.fn(), warn: (...args: unknown[]) => mockWarn(...args) },
}))
jest.mock('../pericopes', () => ({
  requirePericopePath: (versionId: string) =>
    `file:///documents/bible-${versionId.toLowerCase()}-pericope.json`,
}))
jest.mock('../redWords', () => ({
  requireRedWordsPath: (versionId: string) => `file:///documents/red-words-${versionId}.json`,
}))
jest.mock('../legacyBibleSideFiles', () => ({
  removeLegacyBibleSideFiles: (...args: unknown[]) => mockRemoveLegacyBibleSideFiles(...args),
  clearLegacyBibleSideFileCaches: (...args: unknown[]) =>
    mockClearLegacyBibleSideFileCaches(...args),
}))

import { downloadAndInsertBible } from '../downloadBibleToSqlite'

const extractedPath = (entry: string) => `file:///cache/bible-NBS-extract/${entry}`

const canonicalBible = (schemaVersion: number) =>
  JSON.stringify({
    format: 'bible-strong-canonical-bible',
    schemaVersion,
    applicationVersionId: 'NBS',
    datasetId: 'NBS',
    sourceVersion: 'NBS',
    textRevision: 'nbs-r2',
    textSha256: 'c'.repeat(64),
    sourceSha256: 'd'.repeat(64),
    verseCount: 1,
    verses: { 1: { 1: { 1: { text: 'Au commencement', startTags: [], layout: [] } } } },
  })

const install = (archiveEntries: { canonical: string; pericope?: string; redWords?: string }) =>
  downloadAndInsertBible('NBS', 'https://example.test/nbs.zip', {
    archiveEntries,
    expectedArchiveSha256: 'a'.repeat(64),
  })

describe('downloadAndInsertBible legacy side files', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockFiles.clear()
    mockFiles.set('file:///cache/bible-NBS-temp.zip', 'archive')
    mockFiles.set('file:///documents/bible-nbs-pericope.json', '{"stale":true}')
    mockFiles.set('file:///documents/red-words-NBS.json', '{"stale":true}')
    mockInsertBibleVersion.mockResolvedValue(undefined)
  })

  it.each([4, 5])(
    'removes stale side files once a schema %i canonical copy is committed',
    async schemaVersion => {
      mockFiles.set(extractedPath('bible-nbs.json'), canonicalBible(schemaVersion))

      await install({ canonical: 'bible-nbs.json' })

      expect(mockRemoveLegacyBibleSideFiles).toHaveBeenCalledWith('NBS', [])
      expect(mockRemoveLegacyBibleSideFiles.mock.invocationCallOrder[0]).toBeGreaterThan(
        mockInsertBibleVersion.mock.invocationCallOrder[0]!
      )
    }
  )

  it('keeps side files shipped by the same canonical archive', async () => {
    mockFiles.set(extractedPath('bible-nbs.json'), canonicalBible(4))
    mockFiles.set(extractedPath('red-words-NBS.json'), '{}')

    await install({ canonical: 'bible-nbs.json', redWords: 'red-words-NBS.json' })

    expect(mockRemoveLegacyBibleSideFiles).toHaveBeenCalledWith('NBS', [
      'file:///documents/red-words-NBS.json',
    ])
  })

  it.each([
    ['a legacy JSON copy', JSON.stringify({ 1: { 1: { 1: 'Au commencement' } } })],
    ['a schema 3 canonical copy', canonicalBible(3)],
  ])('keeps side files and only refreshes caches for %s', async (_label, content) => {
    mockFiles.set(extractedPath('bible-nbs.json'), content)

    await install({ canonical: 'bible-nbs.json' })

    expect(mockRemoveLegacyBibleSideFiles).not.toHaveBeenCalled()
    expect(mockClearLegacyBibleSideFileCaches).toHaveBeenCalledWith('NBS')
  })

  it('leaves the previous legacy copy intact when the canonical import fails', async () => {
    mockFiles.set(extractedPath('bible-nbs.json'), canonicalBible(4))
    mockInsertBibleVersion.mockRejectedValue(new Error('SQLITE_FULL'))

    await expect(install({ canonical: 'bible-nbs.json' })).rejects.toThrow('SQLITE_FULL')

    expect(mockRemoveLegacyBibleSideFiles).not.toHaveBeenCalled()
    expect(mockFiles.has('file:///documents/bible-nbs-pericope.json')).toBe(true)
  })
})

describe('downloadAndInsertBible text identity', () => {
  const declared = {
    textRevision: 'bhg-e15bd9f0f1a91140579c',
    textSha256: 'e15bd9f0f1a91140579c9eb9c8f4e173b8a4df361859758e0fe252ef55edc107',
  }
  const flatBhg = JSON.stringify({ 1: { 1: { 1: 'בְּרֵאשִׁית', 2: 'וְהָאָרֶץ' } } })
  const canonicalBhg = JSON.stringify({
    format: 'bible-strong-canonical-bible',
    schemaVersion: 4,
    applicationVersionId: 'BHG',
    datasetId: 'ordinary-bible-bhg',
    sourceVersion: 'STEP',
    textRevision: 'bhg-file-revision',
    textSha256: 'f'.repeat(64),
    sourceSha256: 'd'.repeat(64),
    verseCount: 1,
    verses: { 1: { 1: { 1: { text: 'בְּרֵאשִׁית', startTags: [], layout: [] } } } },
  })
  const installBhg = (content: string, declaredTextIdentity?: typeof declared) => {
    mockFiles.set('file:///cache/bible-BHG-extract/bible-step.json', content)
    return downloadAndInsertBible('BHG', 'https://example.test/bible-step.json.zip', {
      archiveEntries: { canonical: 'bible-step.json' },
      expectedArchiveSha256: 'a'.repeat(64),
      ...(declaredTextIdentity ? { declaredTextIdentity } : {}),
    })
  }
  const insertedMetadata = () => mockInsertBibleVersion.mock.calls[0]?.[2]?.publicationMetadata

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockFiles.clear()
    mockFiles.set('file:///cache/bible-BHG-temp.zip', 'archive')
    mockInsertBibleVersion.mockResolvedValue(undefined)
  })

  it('records the text the catalog declares for a copy without a revision of its own', async () => {
    await installBhg(flatBhg, declared)

    expect(insertedMetadata()).toMatchObject({
      ...declared,
      sourceSha256: 'b'.repeat(64),
      verseCount: 2,
      resourceGeneration: 'nbs-r2',
    })
  })

  it('records a revision no index can match when nothing names the text', async () => {
    await installBhg(flatBhg)

    // Derived from the file: an index built for the published text is then never applied.
    expect(insertedMetadata()).toMatchObject({
      textRevision: `bhg-${'b'.repeat(20)}`,
      textSha256: 'b'.repeat(64),
    })
  })

  it('lets a copy that declares its revision be its own authority', async () => {
    await installBhg(canonicalBhg, declared)

    expect(insertedMetadata()).toMatchObject({
      textRevision: 'bhg-file-revision',
      textSha256: 'f'.repeat(64),
      schemaVersion: 4,
    })
    expect(mockWarn).toHaveBeenCalledWith(
      'download',
      'bible.catalog_text_identity_mismatch',
      expect.objectContaining({
        versionId: 'BHG',
        catalogTextRevision: declared.textRevision,
        fileTextRevision: 'bhg-file-revision',
      })
    )
  })
})
