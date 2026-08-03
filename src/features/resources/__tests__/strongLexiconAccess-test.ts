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
import { formatStrongEntityDisplayName, localStrongLexiconAccess } from '../strongLexiconAccess'

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
        uStrong: 'H3068G',
        gloss: 'SEIGNEUR',
      }),
    ])
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(NULLIF(tr.gloss, ''), e.gloss) LIKE ?"),
      ['fr', 'S%', 25]
    )
  })

  it('returns the full unified Strong code when the STEP identity is classical', async () => {
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
        uStrong: 'H3651C',
      }),
    ])
    expect(database.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('e.dStrong LIKE ?'), [
      'fr',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      '%H3651C%',
      25,
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
        uStrong: 'H0310A',
      }),
    ])
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
      getAllAsync: jest.fn(async (sql: string) =>
        sql.includes('FROM StepEntries e') ? [{ stepCode: 'G4074G' }, { stepCode: 'G4074' }] : []
      ),
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
            targetUStrong: 'G0406',
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

    await expect(localStrongLexiconAccess.loadEntity('Peter@Matt.4.18', 'fr')).resolves.toEqual(
      expect.objectContaining({
        uniqueName: 'Peter@Matt.4.18',
        uStrong: 'G4074G',
        strongCodes: ['G4074G', 'G4074'],
        name: 'Pierre',
        category: 'person',
        relations: [
          expect.objectContaining({
            relation: 'sibling',
            targetId: 114,
            targetName: 'André',
            targetUniqueName: 'Andrew@Matt.4.18',
            targetUStrong: 'G0406',
            targetCategory: 'person',
            targetType: 'Male',
          }),
        ],
      })
    )
    expect(entitiesDatabase.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.uniqueName=?'),
      ['fr', 'Peter@Matt.4.18']
    )
    expect(coreDatabase.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.uStrong=?'),
      ['G4074G', 'G4074G']
    )
  })

  it('resolves legacy relation targets and leaves missing targets non-navigable', async () => {
    const coreDatabase = {
      getAllAsync: jest.fn(async (sql: string) =>
        sql.includes('FROM StepEntries e') ? [{ stepCode: 'H6882' }] : []
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
        uStrong: 'H6882',
        strongCodes: ['H6882'],
        name: 'Zorathites',
        category: 'group',
        relations: [
          expect.objectContaining({
            relation: 'offspring',
            targetId: 3465,
            targetName: 'Etam',
            targetUniqueName: 'Etam@1Ch.4.3-',
            targetUStrong: 'H5862H',
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
      expect.stringContaining('WHERE e.uStrong=?'),
      ['H6882', 'H6882']
    )
  })

  it.each([
    ['a_wife_of_Eliphaz', 'a wife of Eliphaz'],
    ['Achor_Valley', 'Achor Valley'],
    ['unknown_woman@Gen.10.11', 'unknown woman@Gen.10.11'],
  ])('formats the TIPNR display name %s', (input, expected) => {
    expect(formatStrongEntityDisplayName(input)).toBe(expected)
  })
})
