/* eslint-disable import/first */

jest.mock('~helpers/strongLexiconModules', () => ({
  getStrongLexiconDatabase: jest.fn(),
  getOptionalStrongLexiconDatabase: jest.fn(),
  getStrongLexiconModuleAvailability: jest.fn(),
}))

import {
  getOptionalStrongLexiconDatabase,
  getStrongLexiconDatabase,
  getStrongLexiconModuleAvailability,
} from '~helpers/strongLexiconModules'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import type { SQLiteDatabase } from '~helpers/sqlite'
import { localStrongLexiconAccess } from '../strongLexiconAccess'

const mockGetStrongLexiconDatabase = jest.mocked(getStrongLexiconDatabase)
const mockGetOptionalStrongLexiconDatabase = jest.mocked(getOptionalStrongLexiconDatabase)
const mockGetStrongLexiconModuleAvailability = jest.mocked(getStrongLexiconModuleAvailability)

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
    mockGetStrongLexiconDatabase.mockResolvedValue(database as unknown as SQLiteDatabase)
    mockGetOptionalStrongLexiconDatabase.mockResolvedValue(null)
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
    mockGetStrongLexiconDatabase.mockResolvedValue(database as unknown as SQLiteDatabase)
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
    mockGetStrongLexiconDatabase.mockResolvedValue(database as unknown as SQLiteDatabase)

    await expect(
      localStrongLexiconAccess.loadEntry({ kind: 'dstrong', code: 'H9999Z' }, 'fr')
    ).resolves.toBeUndefined()
  })

  it('browses localized glosses by prefix inside SQLite before applying the limit', async () => {
    const database = createDatabase()
    database.getAllAsync.mockResolvedValue([rows.H3068G])
    mockGetStrongLexiconDatabase.mockResolvedValue(database as unknown as SQLiteDatabase)

    await expect(localStrongLexiconAccess.browseByGlossPrefix('S', 'fr', 25)).resolves.toEqual([
      expect.objectContaining({
        stepCode: 'H3068G',
        gloss: 'SEIGNEUR',
      }),
    ])
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(NULLIF(tr.gloss, ''), e.gloss) LIKE ?"),
      ['fr', 'S%', 25]
    )
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
    mockGetStrongLexiconDatabase.mockResolvedValue(database as unknown as SQLiteDatabase)

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

  it('loads a Biblical entity by its durable unique name with navigable relations', async () => {
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
        if (sql.includes('EntityRelations')) {
          return [
            {
              relation: 'sibling',
              certainty: 'asserted',
              toEntityId: 114,
              targetUniqueName: 'Andrew@Matt.4.18',
              targetUStrong: 'G0406',
              targetCategory: 'person',
              targetType: 'Male',
              targetName: 'Andrew',
              localizedTargetName: 'André',
              toUniqueName: 'Andrew@Matt.4.18',
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
    mockGetOptionalStrongLexiconDatabase.mockResolvedValue(
      entitiesDatabase as unknown as SQLiteDatabase
    )

    await expect(localStrongLexiconAccess.loadEntity('Peter@Matt.4.18', 'fr')).resolves.toEqual(
      expect.objectContaining({
        uniqueName: 'Peter@Matt.4.18',
        uStrong: 'G4074G',
        name: 'Pierre',
        category: 'person',
        relations: [
          expect.objectContaining({
            relation: 'sibling',
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
    expect(entitiesDatabase.getFirstAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('EntityRefs'),
      expect.anything()
    )
    expect(entitiesDatabase.getAllAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('EntityRefs'),
      expect.anything()
    )
  })
})
