import { getDoc, updateDoc } from '../firebase'
import {
  batchWriteSubcollection,
  clearSubcollection,
  fetchSubcollection,
  writeAllToSubcollection,
  getInvalidSubcollectionDocumentIds,
  SUBCOLLECTION_NAMES,
} from '../firestoreSubcollections'
import {
  inspectEmbeddedDataMigration,
  inspectRelationsArchitectureMigration,
  migrateUserRelationsArchitecture,
  migrateImportedDataToSubcollections,
  reconcileEmbeddedMigrationSources,
} from '../firestoreMigration'
import { readAccountMigrationMutationJournal } from '../../migrations/accountMigrationMutationJournal'

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}))

jest.mock('../firebase', () => ({
  firebaseDb: {},
  doc: jest.fn(() => ({ path: 'user-doc' })),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteField: jest.fn(() => ({ __delete: true })),
}))

jest.mock('../AutoBackupManager', () => ({
  autoBackupManager: {
    createBackupNow: jest.fn(),
  },
}))

jest.mock('../../migrations/accountMigrationMutationJournal', () => ({
  readAccountMigrationMutationJournal: jest.fn(() => ({
    version: 1,
    preferredDocumentIds: {},
    deletedDocumentIds: {},
  })),
  clearAccountMigrationMutationJournal: jest.fn(),
}))

jest.mock('../migrationState', () => ({
  createInitialMigrationState: jest.fn(),
  setMigrationState: jest.fn(),
  updateCollectionStatus: jest.fn(),
  clearMigrationState: jest.fn(),
  getCollectionsToMigrate: jest.fn(() => []),
}))

jest.mock(
  'src/state/migration',
  () => ({
    setMigrationProgressFromOutsideReact: jest.fn(),
    resetMigrationProgressFromOutsideReact: jest.fn(),
  }),
  { virtual: true }
)

jest.mock('../firestoreSubcollections', () => {
  const collectionNames = [
    'notes',
    'links',
    'relations',
    'relationIndex',
    'relationPairs',
    'wordAnnotations',
  ]

  return {
    SUBCOLLECTION_NAMES: collectionNames,
    clearSubcollection: jest.fn(async () => undefined),
    batchWriteSubcollection: jest.fn(async () => undefined),
    fetchSubcollection: jest.fn(async () => ({})),
    writeAllToSubcollection: jest.fn(async () => undefined),
    getInvalidSubcollectionDocumentIds: jest.fn((docIds: string[]) =>
      docIds
        .filter(docId => !docId || docId === '.' || docId === '..')
        .map(docId => ({ docId: docId || '(empty)', reason: 'empty' }))
    ),
  }
})

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}))

describe('firestoreMigration import', () => {
  let logSpy: jest.SpyInstance
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('validates all imported IDs before clearing existing subcollections', async () => {
    await expect(
      migrateImportedDataToSubcollections('user-1', {
        notes: {
          '': { title: 'Invalid note' },
        },
      })
    ).rejects.toThrow('Invalid document IDs')

    expect(getInvalidSubcollectionDocumentIds).toHaveBeenCalled()
    expect(clearSubcollection).not.toHaveBeenCalled()
    expect(writeAllToSubcollection).not.toHaveBeenCalled()
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('replaces every subcollection and writes backfilled relations from legacy notes', async () => {
    await migrateImportedDataToSubcollections('user-1', {
      notes: {
        '1-1-1': {
          title: 'Imported note',
          description: 'Body mentions KJVS',
          date: 1,
          version: 'KJVS',
        },
      },
    })

    expect(clearSubcollection).toHaveBeenCalledTimes(SUBCOLLECTION_NAMES.length)
    expect(clearSubcollection).toHaveBeenCalledWith('user-1', 'links', expect.any(Function))

    const writtenCollections = (writeAllToSubcollection as jest.Mock).mock.calls.map(
      call => call[1]
    )
    expect(writtenCollections).toEqual(
      expect.arrayContaining(['notes', 'relations', 'relationIndex', 'relationPairs'])
    )
    expect(writtenCollections).not.toContain('links')

    const relationsWrite = (writeAllToSubcollection as jest.Mock).mock.calls.find(
      call => call[1] === 'relations'
    )
    const notesWrite = (writeAllToSubcollection as jest.Mock).mock.calls.find(
      call => call[1] === 'notes'
    )
    expect(notesWrite?.[2]['1-1-1']).toMatchObject({
      version: 'KJV',
      description: 'Body mentions KJVS',
    })
    expect(Object.values(relationsWrite?.[2] || {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'system',
          type: 'annotates',
          endpointKeys: ['note:1-1-1', 'verse:1-1-1'],
        }),
      ])
    )
    expect(updateDoc).toHaveBeenCalledWith({ path: 'user-doc' }, { _migrated: true })
  })
})

describe('firestore account migration inspection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('fails closed when embedded Firestore data cannot be inspected', async () => {
    ;(getDoc as jest.Mock).mockRejectedValueOnce(new Error('offline'))

    await expect(inspectEmbeddedDataMigration('user-1')).rejects.toThrow('offline')
  })

  it.each([
    [{ _relationsMigrated: true, _relationsCleanupVersion: 1 }, false],
    [{ _relationsMigrated: true, _relationsCleanupVersion: 0 }, true],
    [{ _relationsMigrated: false, _relationsCleanupVersion: 1 }, true],
  ])('derives relation migration need from account markers', async (data, required) => {
    ;(getDoc as jest.Mock).mockResolvedValueOnce({ data: () => data })

    await expect(inspectRelationsArchitectureMigration('user-1')).resolves.toEqual({ required })
  })
})

describe('embedded migration reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(readAccountMigrationMutationJournal as jest.Mock).mockReturnValue({
      version: 1,
      preferredDocumentIds: { notes: ['updated-note'] },
      deletedDocumentIds: { notes: ['deleted-note'] },
    })
    ;(fetchSubcollection as jest.Mock).mockImplementation(
      async (_userId: string, collection: string) =>
        collection === 'notes'
          ? { 'updated-note': { title: 'Canonical update', version: 'KJV' } }
          : {}
    )
  })

  it('prefers queued canonical documents and preserves deletion tombstones', async () => {
    const reconciled = await reconcileEmbeddedMigrationSources(
      'user-1',
      {
        notes: {
          'updated-note': { title: 'Stale embedded copy', version: 'KJVS' },
          'remote-update': { title: 'Newer embedded update', version: 'KJVS' },
          'deleted-note': { title: 'Deleted locally', version: 'KJVS' },
        },
      },
      { notes: { 'updated-note': { title: 'Canonical update', version: 'KJV' } } }
    )

    expect(reconciled.notes).toEqual({
      'updated-note': { title: 'Canonical update', version: 'KJV' },
      'remote-update': { title: 'Newer embedded update', version: 'KJVS' },
    })
    expect(batchWriteSubcollection).toHaveBeenCalledWith('user-1', 'notes', {
      set: {},
      delete: ['deleted-note'],
    })
    expect(fetchSubcollection).not.toHaveBeenCalled()
  })

  it('reads only collections whose preferred journal entries are absent locally', async () => {
    await reconcileEmbeddedMigrationSources('user-1', {
      notes: { 'updated-note': { title: 'Stale embedded copy' } },
    })

    expect(fetchSubcollection).toHaveBeenCalledTimes(1)
    expect(fetchSubcollection).toHaveBeenCalledWith('user-1', 'notes')
  })
})

describe('relations architecture migration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(getDoc as jest.Mock).mockResolvedValue({ data: () => ({ _relationsMigrated: false }) })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('upserts source relations before deleting only obsolete derived documents', async () => {
    const manualRelation = {
      id: 'manual-1',
      kind: 'manual',
      type: 'linked',
      direction: 'none',
      endpoints: [
        { type: 'verse', verseKeys: ['1-1-1'] },
        { type: 'verse', verseKeys: ['1-1-2'] },
      ],
      createdAt: 1,
      updatedAt: 1,
    }
    ;(fetchSubcollection as jest.Mock).mockImplementation(
      async (_userId: string, collection: string) => {
        if (collection === 'relations') return { 'manual-1': manualRelation }
        if (collection === 'relationIndex') return { obsoleteIndex: { relationIds: [] } }
        if (collection === 'relationPairs') return { obsoletePair: { relationId: 'missing' } }
        return {}
      }
    )

    await expect(
      migrateUserRelationsArchitecture('user-1', { user: { bible: {} } } as never)
    ).resolves.toEqual({ success: true })

    expect(clearSubcollection).not.toHaveBeenCalledWith('user-1', 'relations')
    expect(batchWriteSubcollection).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'relations',
      expect.objectContaining({
        set: expect.objectContaining({ 'manual-1': expect.objectContaining({ id: 'manual-1' }) }),
        delete: [],
        merge: false,
      })
    )
    expect(batchWriteSubcollection).toHaveBeenCalledWith(
      'user-1',
      'relationIndex',
      expect.objectContaining({ delete: ['obsoleteIndex'], merge: false })
    )
    expect(batchWriteSubcollection).toHaveBeenCalledWith(
      'user-1',
      'relationPairs',
      expect.objectContaining({ delete: ['obsoletePair'], merge: false })
    )
  })
})
