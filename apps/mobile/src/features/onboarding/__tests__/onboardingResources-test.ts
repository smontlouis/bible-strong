import type { DownloadItem } from '~state/downloadQueue'
import {
  createDownloadItemFromOnboardingSelection,
  getDefaultOnboardingResourceSelection,
  getOnboardingDatabaseResourceOptions,
  getOnboardingResourceDisplayName,
  getOnboardingResourceSelectionId,
  toggleOnboardingResourceSelection,
} from '../onboardingResources'

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn((lang: string) => (lang === 'en' ? 'KJV' : 'LSG')),
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    BHG: {
      id: 'BHG',
      name: 'Bible hébraïque et grecque',
      name_en: 'Hebrew & Greek Bible',
    },
  },
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
  createStrongSidecarDownloadItem: jest.fn(
    (versionId: string): DownloadItem =>
      ({
        id: `bible-strong:${versionId}`,
        type: 'bible-strong-sidecar',
        name: `${versionId} Strong`,
        versionId,
      }) as DownloadItem
  ),
  createInterlinearSidecarDownloadItem: jest.fn(
    (lang: string): DownloadItem =>
      ({
        id: `bible-interlinear:BHG:${lang}`,
        type: 'bible-interlinear-sidecar',
        name: `BHG ${lang}`,
        lang,
      }) as DownloadItem
  ),
  createStrongLexiconModuleDownloadItem: jest.fn(
    (moduleId: string): DownloadItem =>
      ({
        id: `strong-lexicon:${moduleId}`,
        type: 'strong-lexicon-module',
        name: moduleId,
        strongLexiconModuleId: moduleId,
      }) as DownloadItem
  ),
}))

jest.mock('~helpers/databases', () => ({
  databases: jest.fn(() => ({
    MHY: { id: 'MHY', name: 'Matthew Henry', desc: '', fileSize: 1, path: '' },
    NAVE: { id: 'NAVE', name: 'Nave', desc: '', fileSize: 1, path: '' },
  })),
}))

describe('onboardingResources', () => {
  it('stores Bible selections as durable identifiers', () => {
    expect(getOnboardingResourceSelectionId({ kind: 'bible', versionId: 'LSG' })).toBe('bible:LSG')
  })

  it('stores the modular Strong core with its dedicated durable identifier', () => {
    expect(getOnboardingResourceSelectionId({ kind: 'strong-lexicon' })).toBe('strong-lexicon:core')
  })

  it('stores Strong sidecar selections separately from their base Bible', () => {
    expect(getOnboardingResourceSelectionId({ kind: 'bible-strong', versionId: 'DBY' })).toBe(
      'bible-strong:DBY'
    )
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

  it('converts Strong sidecar selections through the download item Adapter', () => {
    expect(
      createDownloadItemFromOnboardingSelection({
        kind: 'bible-strong',
        versionId: 'DBR',
      })
    ).toEqual(
      expect.objectContaining({
        id: 'bible-strong:DBR',
        versionId: 'DBR',
        dependsOnId: 'bible:DBR',
      })
    )
  })

  it('encodes onboarding download dependencies in the queue items', () => {
    expect(
      createDownloadItemFromOnboardingSelection({
        kind: 'strong-lexicon',
        moduleId: 'entities',
      })
    ).toEqual(expect.objectContaining({ dependsOnId: 'strong-lexicon:core' }))
    expect(
      createDownloadItemFromOnboardingSelection({ kind: 'bible-interlinear', lang: 'fr' })
    ).toEqual(expect.objectContaining({ dependsOnId: 'bible:BHG' }))
  })

  it('localizes technical resource names for the English review', () => {
    const labels: Record<string, string> = {
      'offlineSetup.resources.strongLexicon': 'Strong lexicon',
      'offlineSetup.resources.entities': 'Biblical entities',
      'offlineSetup.resources.greekDictionary': 'Detailed Greek dictionary',
    }
    const translate = (key: string) => labels[key] ?? key

    expect(
      getOnboardingResourceDisplayName(
        { kind: 'strong-lexicon', moduleId: 'core' },
        'en',
        translate
      )
    ).toBe('Strong lexicon')
    expect(
      getOnboardingResourceDisplayName(
        { kind: 'strong-lexicon', moduleId: 'entities' },
        'en',
        translate
      )
    ).toBe('Biblical entities')
    expect(
      getOnboardingResourceDisplayName(
        { kind: 'strong-lexicon', moduleId: 'resources' },
        'en',
        translate
      )
    ).toBe('Detailed Greek dictionary')
    expect(
      getOnboardingResourceDisplayName({ kind: 'bible', versionId: 'BHG' }, 'en', translate)
    ).toBe('Hebrew & Greek Bible')
  })

  it('selecting Strong also selects its base Bible and deselecting the base removes Strong', () => {
    const withStrong = toggleOnboardingResourceSelection([], {
      kind: 'bible-strong',
      versionId: 'LSG',
    })

    expect(withStrong).toEqual([
      { kind: 'bible', versionId: 'LSG' },
      { kind: 'bible-strong', versionId: 'LSG' },
    ])

    expect(
      toggleOnboardingResourceSelection(withStrong, {
        kind: 'bible',
        versionId: 'LSG',
      })
    ).toEqual([])
  })
})
