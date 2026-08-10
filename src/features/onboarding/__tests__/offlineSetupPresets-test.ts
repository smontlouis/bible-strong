import {
  getDefaultOfflineSetupFolderOptionIds,
  getOfflineSetupFolderSections,
  resolveOfflineSetupFolderOptionIds,
  toggleOfflineSetupOptionId,
} from '../offlineSetupPresets'

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG', name: 'Segond', language: 'fr' },
    DBY: { id: 'DBY', name: 'Darby FR', language: 'fr' },
    DBR: { id: 'DBR', name: 'Rabbinat', language: 'fr' },
    KJV: { id: 'KJV', name: 'King James', language: 'en' },
    NASB2020: { id: 'NASB2020', name: 'NASB', language: 'en' },
    NASB1995: { id: 'NASB1995', name: 'NASB 1995', language: 'en' },
    BSB: { id: 'BSB', name: 'BSB', language: 'en' },
    ASV: { id: 'ASV', name: 'ASV', language: 'en' },
    DARBY: { id: 'DARBY', name: 'Darby EN', language: 'en' },
    RLT: { id: 'RLT', name: 'RLT', language: 'en' },
    RWEBSTER: { id: 'RWEBSTER', name: 'RWebster', language: 'en' },
    RV1895: { id: 'RV1895', name: 'RV1895', language: 'en' },
    BHG: { id: 'BHG', name: 'Hebrew & Greek', language: 'he-grc' },
  },
}))

jest.mock('~helpers/databases', () => ({
  databases: jest.fn((lang: string) => ({
    DICTIONNAIRE: { name: `Dictionary ${lang}`, desc: '' },
    NAVE: { name: `Nave ${lang}`, desc: '' },
    TRESOR: { name: 'Cross references', desc: '' },
    MHY: { name: 'Commentary', desc: '' },
    TIMELINE: { name: `Timeline ${lang}`, desc: '' },
  })),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn((lang: string) => (lang === 'fr' ? 'LSG' : 'KJV')),
}))

jest.mock('~helpers/strongBiblePublications', () => ({
  STRONG_BIBLE_PUBLICATIONS: {
    LSG: {},
    DBY: {},
    DBR: {},
    KJV: {},
    NASB2020: {},
    NASB1995: {},
    BSB: {},
    ASV: {},
    DARBY: {},
    RLT: {},
    RWEBSTER: {},
    RV1895: {},
  },
  FRENCH_STRONG_BIBLE_PRIORITY: ['LSG', 'DBY', 'DBR'],
  ENGLISH_STRONG_BIBLE_PRIORITY: [
    'KJV',
    'NASB2020',
    'NASB1995',
    'BSB',
    'ASV',
    'DARBY',
    'RLT',
    'RWEBSTER',
    'RV1895',
  ],
}))

describe('offline setup folders', () => {
  it('locks the language-specific startup Bible as the only default selection', () => {
    expect(getDefaultOfflineSetupFolderOptionIds('fr')).toEqual({
      'read-bible': ['bible:LSG'],
      'understand-words': [],
      'explore-bible': [],
      'original-languages': [],
    })
    const required = getOfflineSetupFolderSections('read-bible', 'fr')
      .flatMap(section => section.options)
      .find(option => option.id === 'bible:LSG')
    expect(required?.required).toBe(true)
    expect(toggleOfflineSetupOptionId(['bible:LSG'], required!)).toEqual(['bible:LSG'])
  })

  it('lists only French and English Bibles in the reading folder', () => {
    const sections = getOfflineSetupFolderSections('read-bible', 'fr')
    const options = sections.flatMap(section => section.options)
    expect(options.map(option => option.id)).toEqual(
      expect.arrayContaining(['bible:LSG', 'bible:KJV'])
    )
    expect(options.map(option => option.id)).not.toContain('bible:BHG')
    expect(sections.map(section => section.titleKey)).toEqual([
      'versionCatalog.language.fr',
      'versionCatalog.language.en',
    ])
    expect(sections[0]?.options.map(option => option.id)).toEqual([
      'bible:DBY',
      'bible:DBR',
      'bible:LSG',
    ])
  })

  it('uses the default Strong Bible catalog sections and ordering', () => {
    const sections = getOfflineSetupFolderSections('understand-words', 'en')

    expect(sections.map(section => section.titleKey)).toEqual([
      'offlineSetup.section.sharedTools',
      'versionCatalog.language.en',
      'versionCatalog.language.fr',
    ])
    expect(sections[1]?.options.slice(0, 3).map(option => option.id)).toEqual([
      'bible-strong:ASV',
      'bible-strong:BSB',
      'bible-strong:DARBY',
    ])
  })

  it('expands a Strong Bible into its base, index, and shared lexicon without duplicates', () => {
    const ids = getDefaultOfflineSetupFolderOptionIds('fr')
    ids['understand-words'] = ['bible-strong:LSG', 'strong-lexicon:core']
    const resolved = resolveOfflineSetupFolderOptionIds(ids, 'fr')
    const resolvedIds = resolved.map(selection => {
      if (selection.kind === 'bible') return `bible:${selection.versionId}`
      if (selection.kind === 'bible-strong') return `bible-strong:${selection.versionId}`
      if (selection.kind === 'strong-lexicon') {
        return `strong-lexicon:${selection.moduleId ?? 'core'}`
      }
      return selection.kind
    })

    expect(resolvedIds).toHaveLength(3)
    expect(resolvedIds).toEqual(
      expect.arrayContaining(['bible:LSG', 'bible-strong:LSG', 'strong-lexicon:core'])
    )
  })

  it('checks visible dependencies and prevents removing them while still required', () => {
    const options = getOfflineSetupFolderSections('understand-words', 'fr').flatMap(
      section => section.options
    )
    const lsgStrong = options.find(option => option.id === 'bible-strong:LSG')!
    const core = options.find(option => option.id === 'strong-lexicon:core')!
    const selected = toggleOfflineSetupOptionId([], lsgStrong, options)

    expect(selected).toEqual(['bible-strong:LSG', 'strong-lexicon:core'])
    expect(toggleOfflineSetupOptionId(selected, core, options)).toEqual(selected)
  })

  it('offers localized exploration resources and keeps biblical entities', () => {
    const sections = getOfflineSetupFolderSections('explore-bible', 'en')
    const options = sections.flatMap(section => section.options)
    expect(options.map(option => option.id)).toEqual(
      expect.arrayContaining([
        'database:DICTIONNAIRE:en',
        'database:NAVE:en',
        'database:TRESOR:fr',
        'strong-lexicon:entities',
        'database:DICTIONNAIRE:fr',
        'database:MHY:fr',
      ])
    )
    expect(options.map(option => option.id)).not.toContain('database:MHY:en')
  })
})
