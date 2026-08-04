import {
  LEGACY_REFERENCE_EVIDENCE_KEY,
  getLegacyResourceFileCandidates,
  getLegacyReferenceVersionIdsFromReduxState,
  getLegacyReferenceVersionIdsFromJotaiStorage,
  inspectLegacyResourceEvidence,
  readLegacyReferenceEvidence,
  recordLegacyReferenceEvidence,
  resetLegacyReferenceEvidenceCaptureState,
  tryRecordLegacyReferenceEvidence,
} from '../legacyResourceEvidence'

describe('legacyResourceEvidence', () => {
  beforeEach(() => resetLegacyReferenceEvidenceCaptureState())

  it('extracts only technical Bible version references from persisted Redux state', () => {
    expect(
      getLegacyReferenceVersionIdsFromReduxState({
        user: {
          bible: {
            settings: {
              defaultBibleVersion: 'KJVS',
              defaultStrongBibleVersionId: 'LSGS',
              compare: { INT_EN: true, LSG: true },
            },
            notes: {
              note: { version: 'INT', content: 'KJVS is user-authored text' },
              unrelated: { content: 'LSGS' },
            },
            tab: { selectedVersion: 'LSG', strongBibleSourceVersionId: 'KJVS' },
            relations: {
              relation: {
                endpoints: [{ type: 'verse', version: 'LSGS' }],
              },
            },
          },
        },
      })
    ).toEqual(['KJVS', 'LSGS', 'INT_EN', 'LSG', 'INT', 'LSG', 'KJVS', 'LSGS'])
  })

  it('reads legacy references from current and historical Jotai storage keys before hydration', () => {
    const values = new Map<string, string>([
      [
        'tabGroupsAtom',
        JSON.stringify([
          {
            tabs: [
              {
                type: 'bible',
                data: { selectedVersion: 'KJVS', parallelVersions: ['INT_EN', 'LSG'] },
              },
            ],
          },
        ]),
      ],
      ['tabsAtom', JSON.stringify([{ data: { selectedVersion: 'LSGS' } }])],
      ['savedParallelVersions', JSON.stringify(['INT'])],
    ])

    expect(
      getLegacyReferenceVersionIdsFromJotaiStorage({
        getString: key => values.get(key),
        set: jest.fn(),
        remove: jest.fn(),
      })
    ).toEqual(['KJVS', 'INT_EN', 'LSG', 'LSGS', 'INT'])
  })

  it('journals only removed Bible identities and preserves prior evidence', () => {
    const values = new Map<string, string>()
    const backend = {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    }

    recordLegacyReferenceEvidence(['LSGS', 'KJV', 'INT_EN'], backend)
    recordLegacyReferenceEvidence(['KJVS', 'LSGS'], backend)

    expect(readLegacyReferenceEvidence(backend)).toEqual(['LSGS', 'KJVS', 'INT_EN'])
    expect(values.get(LEGACY_REFERENCE_EVIDENCE_KEY)).toBe(
      JSON.stringify(['LSGS', 'KJVS', 'INT_EN'])
    )
  })

  it('fails closed when the reference evidence journal is corrupt', () => {
    const backend = {
      getString: () => '{broken',
      set: jest.fn(),
      remove: jest.fn(),
    }

    expect(() => readLegacyReferenceEvidence(backend)).toThrow('LEGACY_REFERENCE_EVIDENCE_CORRUPT')
    expect(tryRecordLegacyReferenceEvidence(['LSGS'], backend)).toBe(false)
    expect(backend.set).not.toHaveBeenCalled()
  })

  it('retries a transient evidence write before detection instead of silently skipping it', async () => {
    const values = new Map<string, string>()
    let shouldFailWrite = true
    const storage = {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => {
        if (shouldFailWrite) throw new Error('disk-full')
        values.set(key, value)
      },
      remove: (key: string) => values.delete(key),
    }

    expect(tryRecordLegacyReferenceEvidence(['LSGS'], storage)).toBe(false)
    shouldFailWrite = false

    await expect(
      inspectLegacyResourceEvidence({
        documentDirectory: 'file:///documents/',
        rootLanguage: 'fr',
        storage,
        getInstalledBibleVersions: async () => [],
        getFileInfo: async () => ({ exists: false }),
      })
    ).resolves.toMatchObject({ legacyIdentities: ['LSGS'] })
  })

  it('detects root and localized files, shared Bible rows, metadata, queue and references', async () => {
    const values = new Map<string, string>([
      [LEGACY_REFERENCE_EVIDENCE_KEY, JSON.stringify(['LSGS'])],
      ['resource-publication:bible:KJVS', JSON.stringify({ generation: 'old' })],
      [
        'downloadQueue',
        JSON.stringify([{ item: { id: 'database:STRONG:fr', databaseId: 'STRONG', lang: 'fr' } }]),
      ],
      ['savedParallelVersions', JSON.stringify(['INT_EN'])],
    ])
    const candidates = getLegacyResourceFileCandidates('file:///documents/', 'fr')
    const existingPaths = new Set([
      'file:///documents/bible-LSGS.json',
      'file:///documents/bible-kjvs.json.backup',
      'file:///documents/SQLite/interlineaire.sqlite-wal',
      'file:///documents/SQLite/en/interlineaire.sqlite',
      'file:///documents/SQLite/fr/strong.sqlite-shm',
    ])
    expect(candidates.map(candidate => candidate.path)).toEqual(
      expect.arrayContaining([...existingPaths])
    )

    const evidence = await inspectLegacyResourceEvidence({
      documentDirectory: 'file:///documents/',
      rootLanguage: 'fr',
      storage: {
        getString: key => values.get(key),
        set: (key, value) => values.set(key, value),
        remove: key => values.delete(key),
      },
      getInstalledBibleVersions: async () => ['LSG', 'INT_EN'],
      getFileInfo: async path => ({ exists: existingPaths.has(path), size: 10 }),
    })

    expect(evidence).toEqual({
      legacyIdentities: ['LSGS', 'KJVS', 'INT', 'INT_EN', 'STRONG'],
      reclaimedBytes: 50,
    })
  })

  it('maps a root interlinear database to the current resource language', async () => {
    const rootPath = 'file:///documents/SQLite/interlineaire.sqlite'
    const inspect = (rootLanguage: 'fr' | 'en') =>
      inspectLegacyResourceEvidence({
        documentDirectory: 'file:///documents/',
        rootLanguage,
        storage: {
          getString: () => undefined,
          set: jest.fn(),
          remove: jest.fn(),
        },
        getInstalledBibleVersions: async () => [],
        getFileInfo: async path => ({ exists: path === rootPath, size: 1 }),
      })

    await expect(inspect('fr')).resolves.toMatchObject({ legacyIdentities: ['INT'] })
    await expect(inspect('en')).resolves.toMatchObject({ legacyIdentities: ['INT_EN'] })
  })

  it('allowlists legacy paths without targeting canonical resources', () => {
    const paths = getLegacyResourceFileCandidates('file:///documents/', 'fr').map(
      candidate => candidate.path
    )

    expect(paths).not.toEqual(
      expect.arrayContaining([
        'file:///documents/SQLite/bibles.sqlite',
        'file:///documents/SQLite/bible-lsg-strong.sqlite',
        'file:///documents/SQLite/bible-bhg-interlinear-fr.sqlite',
        'file:///documents/SQLite/strong_lexicon.core.sqlite',
      ])
    )
    expect(
      paths.every(path => /(?:LSGS|KJVS|lsgs|kjvs|interlineaire|strong\.sqlite)/.test(path))
    ).toBe(true)
  })

  it('returns no migration evidence on a clean device', async () => {
    await expect(
      inspectLegacyResourceEvidence({
        documentDirectory: 'file:///documents/',
        rootLanguage: 'fr',
        storage: {
          getString: () => undefined,
          set: jest.fn(),
          remove: jest.fn(),
        },
        getInstalledBibleVersions: async () => ['LSG', 'KJV'],
        getFileInfo: async () => ({ exists: false }),
      })
    ).resolves.toEqual({ legacyIdentities: [], reclaimedBytes: 0 })
  })
})
