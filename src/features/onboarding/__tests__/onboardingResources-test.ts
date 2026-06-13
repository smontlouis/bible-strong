import type { DownloadItem } from '~state/downloadQueue'
import {
  createDownloadItemFromOnboardingSelection,
  getDefaultOnboardingResourceSelection,
  getOnboardingDatabaseResourceOptions,
  getOnboardingResourceSelectionId,
} from '../onboardingResources'

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn((lang: string) => (lang === 'en' ? 'KJV' : 'LSG')),
}))

jest.mock('~helpers/downloadItemFactory', () => ({
  createBibleDownloadItem: jest.fn(
    (versionId: string): DownloadItem =>
      ({
        id: `bible:${versionId}`,
        type: 'bible',
        name: versionId,
        versionId,
      }) as DownloadItem
  ),
  createDatabaseDownloadItem: jest.fn(
    (databaseId: string, lang: string): DownloadItem =>
      ({
        id: `database:${databaseId}:${lang}`,
        type: 'database',
        name: databaseId,
        databaseId,
        lang,
      }) as DownloadItem
  ),
}))

jest.mock('~helpers/databases', () => ({
  databases: jest.fn(() => ({
    STRONG: { id: 'STRONG', name: 'Strong', desc: '', fileSize: 1, path: '' },
    MHY: { id: 'MHY', name: 'Matthew Henry', desc: '', fileSize: 1, path: '' },
    NAVE: { id: 'NAVE', name: 'Nave', desc: '', fileSize: 1, path: '' },
  })),
}))

describe('onboardingResources', () => {
  it('stores Bible selections as durable identifiers', () => {
    expect(getOnboardingResourceSelectionId({ kind: 'bible', versionId: 'LSG' })).toBe('bible:LSG')
  })

  it('stores database selections as durable identifiers including language', () => {
    expect(
      getOnboardingResourceSelectionId({
        kind: 'database',
        databaseId: 'STRONG',
        lang: 'fr',
      })
    ).toBe('database:STRONG:fr')
  })

  it('creates the default selection from the active language', () => {
    expect(getDefaultOnboardingResourceSelection('en')).toEqual({
      kind: 'bible',
      versionId: 'KJV',
    })
    expect(getDefaultOnboardingResourceSelection('fr')).toEqual({
      kind: 'bible',
      versionId: 'LSG',
    })
  })

  it('hides Matthew Henry comments from non-French onboarding resources', () => {
    expect(getOnboardingDatabaseResourceOptions('fr').map(db => db.id)).toContain('MHY')
    expect(getOnboardingDatabaseResourceOptions('en').map(db => db.id)).not.toContain('MHY')
  })

  it('converts Bible selections through the download item Adapter', () => {
    expect(createDownloadItemFromOnboardingSelection({ kind: 'bible', versionId: 'LSG' })).toEqual(
      expect.objectContaining({
        id: 'bible:LSG',
        versionId: 'LSG',
      })
    )
  })

  it('converts database selections through the download item Adapter', () => {
    expect(
      createDownloadItemFromOnboardingSelection({
        kind: 'database',
        databaseId: 'NAVE',
        lang: 'en',
      })
    ).toEqual(
      expect.objectContaining({
        id: 'database:NAVE:en',
        databaseId: 'NAVE',
        lang: 'en',
      })
    )
  })
})
