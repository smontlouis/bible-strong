/* eslint-disable import/first */

jest.mock('~helpers/strongLexiconModules', () => ({
  getStrongLexiconModuleAvailability: jest.fn(),
  withStrongLexiconDatabase: jest.fn(),
  withOptionalStrongLexiconDatabase: jest.fn(),
}))

import {
  getStrongLexiconModuleAvailability,
  withOptionalStrongLexiconDatabase,
  withStrongLexiconDatabase,
} from '~helpers/strongLexiconModules'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import type { SQLiteDatabase } from '~helpers/sqlite'
import {
  createHttpStrongLexiconAccess,
  createHybridStrongLexiconAccess,
  formatStrongEntityDisplayName,
  getTipnrBookCode,
  localStrongLexiconAccess,
  type StrongLexiconAccess,
} from '../strongLexiconAccess'

const mockGetStrongLexiconModuleAvailability = jest.mocked(getStrongLexiconModuleAvailability)
const mockWithStrongLexiconDatabase = jest.mocked(withStrongLexiconDatabase)
const mockWithOptionalStrongLexiconDatabase = jest.mocked(withOptionalStrongLexiconDatabase)

const rows = {
  H3068G: {
    id: 15149,
    language: 'hebrew',
    baseCode: 3068,
    eStrong: 'H3068',
    dStrong: 'H3068G =',
    uStrong: 'H3068G',
    original: 'יְהֹוָה',
    transliteration: 'ye.ho.vah',
    morph: '',
    gloss: 'LORD',
    meaning: 'the existing One',
    classicTransliteration: 'yehôvâh',
    pronunciation: "yeh-ho-vaw'",
    stepCode: 'H3068G',
    localizedGloss: 'SEIGNEUR',
    localizedMeaning: 'celui qui existe',
    localizedMeaningHtml: '<p>celui qui existe</p>',
  },
  H0413: {
    id: 11576,
    language: 'hebrew',
    baseCode: 413,
    eStrong: 'H0413',
    dStrong: 'H0413 =',
    uStrong: 'H0413',
    original: 'אֶל',
    transliteration: 'el',
    morph: '',
    gloss: 'to(wards)',
    meaning: 'towards',
    classicTransliteration: "'êl",
    pronunciation: 'ale',
    stepCode: 'H0413',
    localizedGloss: 'vers',
    localizedMeaning: 'vers',
    localizedMeaningHtml: '<p>vers</p>',
  },
} as const

const createDatabase = () => ({
  getFirstAsync: jest.fn(async (sql: string, parameters: unknown[]) => {
    if (sql.includes('MorphologyCodes')) return null
    const code = parameters.find(
      parameter => parameter === 'H3068G' || parameter === 'H3068' || parameter === 'H0413'
    )
    if (code === 'H3068G' || code === 'H3068') return rows.H3068G
    if (code === 'H0413') return rows.H0413
    return null
  }),
  getAllAsync: jest.fn(async (_sql: string, _parameters?: unknown[]): Promise<unknown[]> => []),
})

describe('strongLexiconAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const database = createDatabase()
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )
    mockWithOptionalStrongLexiconDatabase.mockResolvedValue(null)
    mockGetStrongLexiconModuleAvailability.mockImplementation(
      async (moduleId: StrongLexiconModuleId) => ({
        status: 'missing',
        moduleId,
      })
    )
  })

  it('loads bounded Strong lexicon pages and carries the keyset cursor', async () => {
    const fetcher = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            resource: { revision: 'core-r1' },
            entries: [
              {
                id: 15149,
                stepCode: 'H3068G',
                classicStrong: 'H3068',
                language: 'hebrew',
                original: 'יְהֹוָה',
                transliteration: 'yehovah',
                gloss: 'SEIGNEUR',
              },
            ],
            nextCursor: 'seigneur|3068|15149',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const access = createHttpStrongLexiconAccess({
      baseUrl: 'https://resources.test',
      fetcher: fetcher as typeof fetch,
      isOnline: async () => true,
    })

    await expect(
      access.listEntries({ language: 'fr', prefix: 's', limit: 25, cursor: 'older cursor' })
    ).resolves.toEqual({
      entries: [expect.objectContaining({ stepCode: 'H3068G', gloss: 'SEIGNEUR' })],
      nextCursor: 'seigneur|3068|15149',
    })
    expect(fetcher).toHaveBeenCalledWith(
      'https://resources.test/v1/strong-lexicon/entries?language=fr&limit=25&prefix=s&cursor=older+cursor',
      expect.any(Object)
    )
  })

  it('opens every distinct clicked identity with dStrong entries first', async () => {
    const previews = await localStrongLexiconAccess.loadPreview(
      [
        { kind: 'strong', code: 'H0413' },
        { kind: 'strong', code: 'H3068' },
        { kind: 'dstrong', code: 'H3068G' },
      ],
      'fr'
    )

    expect(previews.map(preview => preview.selectedIdentity)).toEqual([
      { kind: 'dstrong', code: 'H3068G' },
      { kind: 'strong', code: 'H0413' },
    ])
    expect(previews.map(preview => preview.gloss)).toEqual(['SEIGNEUR', 'vers'])
    expect(previews.map(preview => preview.definitionHtml)).toEqual([
      '<p>celui qui existe</p>',
      '<p>vers</p>',
    ])
  })

  it('loads the French rich definition while preserving the selected identity type', async () => {
    const database = createDatabase()
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )
    const entry = await localStrongLexiconAccess.loadEntry(
      { kind: 'dstrong', code: 'H3068G' },
      'fr'
    )

    expect(entry).toEqual(
      expect.objectContaining({
        selectedIdentity: { kind: 'dstrong', code: 'H3068G' },
        stepCode: 'H3068G',
        classicStrong: 'H3068',
        gloss: 'SEIGNEUR',
        definitionHtml: '<p>celui qui existe</p>',
      })
    )
    const relationQuery = database.getAllAsync.mock.calls.find(([sql]) =>
      String(sql).includes('FROM LexiconRelations')
    )?.[0]
    expect(relationQuery).toBeDefined()
    expect(String(relationQuery)).not.toContain('LIMIT 72')
  })

  it('resolves a legacy classical study reference against the unified lexicon', async () => {
    const entry = await localStrongLexiconAccess.loadEntry({ kind: 'strong', code: 'H3068' }, 'fr')

    expect(entry).toEqual(
      expect.objectContaining({
        selectedIdentity: { kind: 'strong', code: 'H3068' },
        classicStrong: 'H3068',
        stepCode: 'H3068G',
      })
    )
    expect(entry).not.toHaveProperty('uStrong')
  })

  it('returns no entry when none of the STEP or classical fallbacks resolves', async () => {
    const database = createDatabase()
    database.getFirstAsync.mockResolvedValue(null)
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    await expect(
      localStrongLexiconAccess.loadEntry({ kind: 'dstrong', code: 'H9999Z' }, 'fr')
    ).resolves.toBeUndefined()
  })

  it('browses localized glosses by prefix inside SQLite before applying the limit', async () => {
    const database = createDatabase()
    database.getAllAsync.mockResolvedValue([rows.H3068G])
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    await expect(localStrongLexiconAccess.browseByGlossPrefix('S', 'fr', 25)).resolves.toEqual([
      expect.objectContaining({
        stepCode: 'H3068G',
        gloss: 'SEIGNEUR',
      }),
    ])
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("lower(COALESCE(NULLIF(tr.gloss, ''), e.gloss)) LIKE ?"),
      ['fr', 'S%', 26]
    )
  })

  it('continues local browse pages after the last key instead of using OFFSET', async () => {
    const pageRows = Array.from({ length: 3 }, (_, index) => ({
      ...rows.H3068G,
      id: 100 + index,
      baseCode: 3000 + index,
      stepCode: `H${3000 + index}`,
      sortGloss: `seigneur-${index}`,
    }))
    const database = createDatabase()
    database.getAllAsync.mockResolvedValue(pageRows)
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    const first = await localStrongLexiconAccess.listEntries({
      language: 'fr',
      prefix: 's',
      limit: 2,
    })
    expect(first.entries).toHaveLength(2)
    expect(first.nextCursor).toBeDefined()

    database.getAllAsync.mockResolvedValue([])
    await localStrongLexiconAccess.listEntries({
      language: 'fr',
      prefix: 's',
      limit: 2,
      cursor: first.nextCursor,
    })
    const [statement, parameters] = database.getAllAsync.mock.calls.at(-1)!
    expect(String(statement)).toContain('sortGloss > ?')
    expect(parameters).toEqual([
      'fr',
      's%',
      'seigneur-1',
      'seigneur-1',
      3001,
      'seigneur-1',
      3001,
      101,
      3,
    ])
  })

  it('selects a random entry from an indexed id threshold without sorting the corpus', async () => {
    const database = {
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ minimum: 100, maximum: 200 })
        .mockResolvedValueOnce(rows.H3068G),
    }
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )
    const random = jest.spyOn(Math, 'random').mockReturnValueOnce(0.5)

    await expect(localStrongLexiconAccess.random('hebrew', 'fr')).resolves.toEqual(
      expect.objectContaining({ stepCode: 'H3068G' })
    )
    const statements = database.getFirstAsync.mock.calls.map(([statement]) => String(statement))
    expect(statements.join('\n')).not.toContain('ORDER BY RANDOM()')
    expect(statements[1]).toContain('e.id >= ?')
    expect(database.getFirstAsync.mock.calls[1]?.[1]).toEqual(['fr', 'hebrew', 150])
    random.mockRestore()
  })

  it('returns the matched STEP Strong code for a disambiguated dictionary identity', async () => {
    const database = createDatabase()
    database.getAllAsync.mockResolvedValue([
      {
        ...rows.H0413,
        id: 3651,
        baseCode: 3651,
        eStrong: 'H3651',
        dStrong: 'H3651C =',
        uStrong: 'H3651C',
        stepCode: 'H3651',
        gloss: 'thus',
        localizedGloss: 'ainsi',
      },
    ])
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    await expect(localStrongLexiconAccess.search('H3651C', 'fr', 25)).resolves.toEqual([
      expect.objectContaining({
        stepCode: 'H3651',
        classicStrong: 'H3651',
      }),
    ])
    expect(database.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('dStrong LIKE ?'), [
      'fr',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      26,
    ])
  })

  it('does not expand an existing Strong identity through its shared unified code', async () => {
    const database = createDatabase()
    const directEntry = {
      ...rows.H0413,
      id: 11446,
      baseCode: 310,
      eStrong: 'H0310a',
      dStrong: 'H0310A =',
      uStrong: 'H0310A',
      stepCode: 'H0310A',
      gloss: 'after',
      localizedGloss: 'après',
    }
    const entriesSharingUnifiedCode = [
      directEntry,
      {
        ...directEntry,
        id: 11448,
        eStrong: 'H0311',
        dStrong: 'H0311 = in Aramaic of',
        stepCode: 'H0311',
      },
      {
        ...directEntry,
        id: 11455,
        eStrong: 'H0318',
        dStrong: 'H0318 = in Aramaic of',
        original: 'אָחֳרֵין',
        stepCode: 'H0318',
        gloss: 'finally',
        localizedGloss: 'finalement',
      },
    ]
    database.getAllAsync.mockImplementation(async (sql: string) =>
      sql.includes('e.uStrong LIKE ?') ? entriesSharingUnifiedCode : [directEntry]
    )
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    await expect(localStrongLexiconAccess.search('H0310A', 'fr', 25)).resolves.toEqual([
      expect.objectContaining({
        id: 11446,
        stepCode: 'H0310A',
      }),
    ])
  })

  it('shows one textual search result when STEP entries share the same unified Strong', async () => {
    const database = createDatabase()
    const entriesSharingUnifiedStrong = [
      {
        ...rows.H0413,
        id: 11446,
        baseCode: 310,
        eStrong: 'H0310a',
        dStrong: 'H0310A =',
        uStrong: 'H0310A',
        stepCode: 'H0310A',
        gloss: 'after',
        localizedGloss: 'après',
      },
      {
        ...rows.H0413,
        id: 11448,
        baseCode: 311,
        eStrong: 'H0311',
        dStrong: 'H0311 = in Aramaic of',
        uStrong: 'H0310A',
        stepCode: 'H0311',
        gloss: 'after',
        localizedGloss: 'après',
      },
    ]
    database.getAllAsync.mockImplementation(async (sql: string) =>
      sql.includes('WHERE unifiedRank=1')
        ? [entriesSharingUnifiedStrong[0]]
        : entriesSharingUnifiedStrong
    )
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    const results = await localStrongLexiconAccess.search('après', 'fr', 25)

    expect(results).toEqual([
      expect.objectContaining({
        id: 11446,
        stepCode: 'H0310A',
      }),
    ])
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ROW_NUMBER() OVER'),
      expect.any(Array)
    )
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE unifiedRank=1'),
      expect.any(Array)
    )
  })

  it('keeps Greek and Hebrew STEP entries distinct when they share a unified Strong', async () => {
    const database = createDatabase()
    const aaronEntries = [
      {
        ...rows.H0413,
        id: 3,
        language: 'greek' as const,
        baseCode: 2,
        eStrong: 'G0002',
        dStrong: 'G0002 = the Greek of',
        uStrong: 'H0175',
        stepCode: 'G0002',
        original: 'Ἀαρών',
        gloss: 'Aaron',
        localizedGloss: 'Aaron',
      },
      {
        ...rows.H0413,
        id: 11257,
        baseCode: 175,
        eStrong: 'H0175',
        dStrong: 'H0175 =',
        uStrong: 'H0175',
        stepCode: 'H0175',
        original: 'אַהֲרֹן',
        gloss: 'Aaron',
        localizedGloss: 'Aaron',
      },
    ]
    database.getAllAsync.mockImplementation(async (sql: string) =>
      sql.includes('PARTITION BY e.language,') ? aaronEntries : [aaronEntries[1]]
    )
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    const results = await localStrongLexiconAccess.search('Aaron', 'fr', 25)

    expect(results.map(result => result.stepCode)).toEqual(['G0002', 'H0175'])
  })

  it('loads the full localized morphology for the selected verse token', async () => {
    const database = createDatabase()
    database.getAllAsync.mockResolvedValue([
      {
        code: 'N-NPM-T',
        normalizedCode: 'N-NPM-T',
        scope: 'tagged_full',
        meaning: 'Noun Nominative Plural Masculine Title',
        description: 'Full English description',
        localizedMeaning: 'Nom, nominatif, masculin, pluriel, titre',
        localizedDescription:
          'Fonction : nom; Cas : nominatif; Genre : masculin; Nombre : pluriel.',
      },
    ])
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(database as unknown as SQLiteDatabase)
    )

    await expect(localStrongLexiconAccess.loadMorphologies(['N-NPM-T'], 'fr')).resolves.toEqual([
      {
        code: 'N-NPM-T',
        meaning: 'Nom, nominatif, masculin, pluriel, titre',
        description: 'Fonction : nom; Cas : nominatif; Genre : masculin; Nombre : pluriel.',
      },
    ])
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHEN 'tagged_full' THEN 0"),
      ['fr', 'N-NPM-T', 'N-NPM-T']
    )
  })

  it('loads a Biblical entity by its durable unique name with localized relations', async () => {
    const coreDatabase = {
      getAllAsync: jest.fn(async (sql: string, parameters: string[]) => {
        if (!sql.includes('FROM StepEntries e')) return []
        return [
          ...(parameters.includes('H0175')
            ? [
                { uStrong: 'H0175', code: 'G0002' },
                { uStrong: 'H0175', code: 'H0175' },
              ]
            : []),
          ...(parameters.includes('G4074G')
            ? [
                { uStrong: 'G4074G', code: 'G4074G' },
                { uStrong: 'G4074G', code: 'G4074' },
              ]
            : []),
        ]
      }),
    }
    const entitiesDatabase = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM Entities e')) {
          return {
            id: 2321,
            uniqueName: 'Peter@Matt.4.18',
            uStrong: 'G4074G',
            displayName: 'Peter',
            category: 'person',
            type: 'Male',
            description: 'Apostle',
            shortDescription: 'One of the twelve apostles',
            summaryHtml: '',
            brief: 'Apostle of Jesus',
            articleHtml: '',
            localizedDisplayName: 'Pierre',
            localizedDescription: 'Apôtre',
            localizedShortDescription: 'Un des douze apôtres',
            localizedSummaryHtml: '',
            localizedBrief: 'Apôtre de Jésus',
            localizedArticleHtml: '',
          }
        }
        if (sql.includes('EntityPlaces')) return null
        return null
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (!sql.includes('EntityRelations')) return []
        return [
          {
            relation: 'sibling',
            certainty: 'asserted',
            targetId: 114,
            targetUniqueName: 'Andrew@Matt.4.18',
            targetUStrong: 'H0175',
            targetCategory: 'person',
            targetType: 'Male',
            targetName: 'Andrew',
            localizedTargetName: 'André',
            toUniqueName: 'Andrew@Matt.4.18',
          },
        ]
      }),
    }
    mockGetStrongLexiconModuleAvailability.mockResolvedValue({
      status: 'available',
      moduleId: 'entities',
      schemaVersion: 1,
    })
    mockWithOptionalStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(entitiesDatabase as unknown as SQLiteDatabase)
    )
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(coreDatabase as unknown as SQLiteDatabase)
    )

    const entity = await localStrongLexiconAccess.loadEntity('Peter@Matt.4.18', 'fr')
    expect(entity).toEqual(
      expect.objectContaining({
        uniqueName: 'Peter@Matt.4.18',
        strongCodes: ['G4074G'],
        name: 'Pierre',
        category: 'person',
        relations: [
          expect.objectContaining({
            relation: 'sibling',
            targetId: 114,
            targetName: 'André',
            targetUniqueName: 'Andrew@Matt.4.18',
            targetStepCodes: ['G0002', 'H0175'],
            targetCategory: 'person',
            targetType: 'Male',
          }),
        ],
      })
    )
    expect(entity).not.toHaveProperty('uStrong')
    expect(entitiesDatabase.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.uniqueName=?'),
      ['fr', 'Peter@Matt.4.18']
    )
    expect(coreDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.uStrong IN (?, ?)'),
      ['G4074G', 'H0175']
    )
    expect(coreDatabase.getAllAsync).toHaveBeenCalledTimes(1)
  })

  it('resolves legacy relation targets and leaves missing targets non-navigable', async () => {
    const coreDatabase = {
      getAllAsync: jest.fn(async (sql: string, parameters: string[]) =>
        sql.includes('FROM StepEntries e')
          ? parameters.map(uStrong => ({ uStrong, code: uStrong }))
          : []
      ),
    }
    const entitiesDatabase = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM Entities e')) {
          return {
            id: 3067,
            uniqueName: 'Zorathites@1Ch.2.53-',
            uStrong: 'H6882',
            displayName: 'Zorathites',
            category: 'group',
            type: 'Group',
            description: 'People of Zorah',
            shortDescription: 'People of Zorah',
            summaryHtml: '',
            brief: 'People of Zorah',
            articleHtml: '',
            localizedDisplayName: null,
            localizedDescription: null,
            localizedShortDescription: null,
            localizedSummaryHtml: '',
            localizedBrief: null,
            localizedArticleHtml: '',
          }
        }
        if (sql.includes('EntityPlaces')) return null
        return null
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('EntityRelations')) {
          return [
            {
              relation: 'offspring',
              certainty: 'asserted',
              toEntityId: null,
              targetId: 3465,
              targetUniqueName: 'Etam@1Ch.4.3-',
              targetUStrong: 'H5862H',
              targetCategory: 'place',
              targetType: 'Place',
              targetName: 'Etam',
              localizedTargetName: null,
              toUniqueName: 'town|Etam@1Ch.4.3-',
            },
            {
              relation: 'founder_or_origin',
              certainty: 'asserted',
              toEntityId: null,
              targetId: null,
              targetUniqueName: null,
              targetUStrong: null,
              targetCategory: null,
              targetType: null,
              targetName: null,
              localizedTargetName: null,
              toUniqueName: 'Asshur@Gen.10.11',
            },
          ]
        }
        return []
      }),
    }
    mockGetStrongLexiconModuleAvailability.mockResolvedValue({
      status: 'available',
      moduleId: 'entities',
      schemaVersion: 1,
    })
    mockWithOptionalStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(entitiesDatabase as unknown as SQLiteDatabase)
    )
    mockWithStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(coreDatabase as unknown as SQLiteDatabase)
    )

    await expect(
      localStrongLexiconAccess.loadEntity('Zorathites@1Ch.2.53-', 'fr')
    ).resolves.toEqual(
      expect.objectContaining({
        uniqueName: 'Zorathites@1Ch.2.53-',
        strongCodes: ['H6882'],
        name: 'Zorathites',
        category: 'group',
        relations: [
          expect.objectContaining({
            relation: 'offspring',
            targetId: 3465,
            targetName: 'Etam',
            targetUniqueName: 'Etam@1Ch.4.3-',
            targetStepCodes: ['H5862H'],
            targetCategory: 'place',
            targetType: 'Place',
          }),
          {
            relation: 'founder_or_origin',
            certainty: 'asserted',
            targetName: 'Asshur@Gen.10.11',
          },
        ],
      })
    )
    expect(entitiesDatabase.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.uniqueName=?'),
      ['fr', 'Zorathites@1Ch.2.53-']
    )
    expect(entitiesDatabase.getFirstAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('EntityRefs'),
      expect.anything()
    )
    expect(entitiesDatabase.getAllAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('EntityRefs'),
      expect.anything()
    )
    expect(entitiesDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("substr(r.toUniqueName, instr(r.toUniqueName, '|') + 1)"),
      ['fr', 3067]
    )
    expect(coreDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.uStrong IN (?, ?)'),
      ['H6882', 'H5862H']
    )
    expect(coreDatabase.getAllAsync).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a_wife_of_Eliphaz', 'a wife of Eliphaz'],
    ['Achor_Valley', 'Achor Valley'],
    ['unknown_woman@Gen.10.11', 'unknown woman@Gen.10.11'],
  ])('formats the TIPNR display name %s', (input, expected) => {
    expect(formatStrongEntityDisplayName(input)).toBe(expected)
  })

  it.each([
    [1, 'Gen'],
    [11, '1Ki'],
    [40, 'Mat'],
    [43, 'Jhn'],
    [66, 'Rev'],
    [67, undefined],
  ])('maps Bible book %s to its TIPNR code', (book, expected) => {
    expect(getTipnrBookCode(book)).toBe(expected)
  })

  it('loads localized chapter entities with deduplicated verse occurrences', async () => {
    const entitiesDatabase = {
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn().mockResolvedValue([
        {
          uniqueName: 'Abraham@Gen.11.26-1Pe',
          displayName: 'Abraham',
          localizedDisplayName: 'Abraham',
          category: 'person',
          type: 'Male',
          verses: '1,3,3,9',
        },
        {
          uniqueName: 'Moriah_Mount@Gen.22.2-2Ch',
          displayName: 'Moriah_Mount',
          localizedDisplayName: 'Mont_Moriah',
          category: 'place',
          type: 'Place',
          verses: '2',
        },
        {
          uniqueName: 'LORD@Gen.1.1-Rev',
          displayName: 'LORD',
          localizedDisplayName: 'SEIGNEUR',
          category: 'other',
          type: 'Supernatural',
          verses: null,
        },
        {
          uniqueName: 'morning@Gen.1.5-Rev',
          displayName: 'morning',
          localizedDisplayName: 'matin',
          category: 'other',
          type: 'Time',
          verses: '1',
        },
      ]),
    }
    mockGetStrongLexiconModuleAvailability.mockResolvedValue({
      status: 'available',
      moduleId: 'entities',
      schemaVersion: 1,
    })
    mockWithOptionalStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(entitiesDatabase as unknown as SQLiteDatabase)
    )

    await expect(
      localStrongLexiconAccess.loadChapterEntities(1, 22, 'fr', [' H3068G ', 'H3068G'])
    ).resolves.toEqual([
      {
        uniqueName: 'Abraham@Gen.11.26-1Pe',
        name: 'Abraham',
        category: 'person',
        type: 'Male',
        verses: [1, 3, 9],
      },
      {
        uniqueName: 'Moriah_Mount@Gen.22.2-2Ch',
        name: 'Mont Moriah',
        category: 'place',
        type: 'Place',
        verses: [2],
      },
      {
        uniqueName: 'LORD@Gen.1.1-Rev',
        name: 'SEIGNEUR',
        category: 'supernatural',
        type: 'Supernatural',
        verses: [],
      },
      {
        uniqueName: 'morning@Gen.1.5-Rev',
        name: 'matin',
        category: 'other',
        type: 'Time',
        verses: [1],
      },
    ])
    expect(entitiesDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN EntityRefs refs'),
      ['fr', 'Gen', 22, 'H3068G']
    )
    expect(entitiesDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('e.uStrong IN (?)'),
      expect.any(Array)
    )
    expect(entitiesDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*) FROM Entities matching'),
      expect.any(Array)
    )
  })

  it('falls back to the source display name and returns an empty available chapter', async () => {
    const entitiesDatabase = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([
          {
            uniqueName: 'Moriah_Mount@Gen.22.2-2Ch',
            displayName: 'Moriah_Mount',
            localizedDisplayName: null,
            category: 'place',
            type: 'Place',
            verses: '2',
          },
        ])
        .mockResolvedValueOnce([]),
    }
    mockGetStrongLexiconModuleAvailability.mockResolvedValue({
      status: 'available',
      moduleId: 'entities',
      schemaVersion: 1,
    })
    mockWithOptionalStrongLexiconDatabase.mockImplementation(async (_moduleId, operation) =>
      operation(entitiesDatabase as unknown as SQLiteDatabase)
    )

    await expect(localStrongLexiconAccess.loadChapterEntities(1, 22, 'fr')).resolves.toEqual([
      expect.objectContaining({ name: 'Moriah Mount' }),
    ])
    await expect(localStrongLexiconAccess.loadChapterEntities(1, 23, 'fr')).resolves.toEqual([])
  })

  it('does not query chapter entities when the module or book is unavailable', async () => {
    await expect(localStrongLexiconAccess.loadChapterEntities(1, 1, 'fr')).resolves.toEqual([])
    await expect(localStrongLexiconAccess.loadChapterEntities(67, 1, 'fr')).resolves.toEqual([])
    expect(mockWithOptionalStrongLexiconDatabase).not.toHaveBeenCalled()
  })
})

const createHybridStub = (
  availability: 'available' | 'missing',
  label: string
): StrongLexiconAccess => ({
  getModuleAvailability: jest.fn(async moduleId =>
    availability === 'available'
      ? { status: 'available' as const, moduleId, revision: label, schemaVersion: 2 }
      : { status: 'missing' as const, moduleId }
  ),
  loadPreview: jest.fn(async () => []),
  loadEntry: jest.fn(async identity => ({ label, selectedIdentity: identity }) as never),
  loadEntries: jest.fn(async () => []),
  loadMorphologies: jest.fn(async () => []),
  loadEntity: jest.fn(async () => undefined),
  loadChapterEntities: jest.fn(async () => []),
  listEntries: jest.fn(async () => ({ entries: [{ gloss: label }] as never })),
  search: jest.fn(async () => [{ gloss: label }] as never),
  browseByGlossPrefix: jest.fn(async () => [{ gloss: label }] as never),
  random: jest.fn(async () => undefined),
})

describe('hybrid Strong lexicon routing', () => {
  it('prefers an installed entry over HTTP', async () => {
    const offline = createHybridStub('available', 'offline')
    const online = createHybridStub('available', 'online')
    const access = createHybridStrongLexiconAccess({
      offline,
      online,
      remotelyReadable: true,
      isOnline: async () => true,
    })

    await expect(access.loadEntry({ kind: 'strong', code: 'G3056' }, 'fr')).resolves.toMatchObject({
      label: 'offline',
    })
    expect(online.loadEntry).not.toHaveBeenCalled()
  })

  it('uses HTTP when the local core is absent', async () => {
    const offline = createHybridStub('missing', 'offline')
    const online = createHybridStub('available', 'online')
    const access = createHybridStrongLexiconAccess({
      offline,
      online,
      remotelyReadable: true,
      isOnline: async () => true,
    })

    await expect(access.loadEntry({ kind: 'strong', code: 'G3056' }, 'fr')).resolves.toMatchObject({
      label: 'online',
    })
  })

  it('searches online first, then uses the installed index while offline', async () => {
    const offline = createHybridStub('available', 'offline')
    const online = createHybridStub('available', 'online')
    let connected = true
    const access = createHybridStrongLexiconAccess({
      offline,
      online,
      remotelyReadable: true,
      isOnline: async () => connected,
    })

    await expect(access.search('parole', 'fr')).resolves.toEqual([
      expect.objectContaining({ gloss: 'online' }),
    ])
    connected = false
    await expect(access.search('parole', 'fr')).resolves.toEqual([
      expect.objectContaining({ gloss: 'offline' }),
    ])
  })
})
