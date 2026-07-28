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
  getAllAsync: jest.fn(async () => []),
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
  })

  it('returns no entry when none of the STEP or classical fallbacks resolves', async () => {
    const database = createDatabase()
    database.getFirstAsync.mockResolvedValue(null)
    mockGetStrongLexiconDatabase.mockResolvedValue(database as unknown as SQLiteDatabase)

    await expect(
      localStrongLexiconAccess.loadEntry({ kind: 'dstrong', code: 'H9999Z' }, 'fr')
    ).resolves.toBeUndefined()
  })
})
