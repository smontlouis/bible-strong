import {
  getDefaultOfflineSetupFolderOptionIds,
  getOfflineSetupFolderSections,
  resolveOfflineSetupFolderOptionIds,
  toggleOfflineSetupOptionId,
} from '../offlineSetupPresets'

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG', name: 'Segond', language: 'fr', readingProfile: 'word-for-word' },
    DBY: { id: 'DBY', name: 'Darby FR', language: 'fr', readingProfile: 'word-for-word' },
    DBR: { id: 'DBR', name: 'Rabbinat', language: 'fr', readingProfile: 'balanced' },
    KJV: { id: 'KJV', name: 'King James', language: 'en', readingProfile: 'word-for-word' },
    NASB2020: {
      id: 'NASB2020',
      name: 'NASB',
      language: 'en',
      readingProfile: 'word-for-word',
    },
    NASB1995: {
      id: 'NASB1995',
      name: 'NASB 1995',
      language: 'en',
      readingProfile: 'word-for-word',
    },
    BSB: { id: 'BSB', name: 'BSB', language: 'en', readingProfile: 'balanced' },
    ASV: { id: 'ASV', name: 'ASV', language: 'en', readingProfile: 'word-for-word' },
    DARBY: { id: 'DARBY', name: 'Darby EN', language: 'en', readingProfile: 'word-for-word' },
    RLT: { id: 'RLT', name: 'RLT', language: 'en', readingProfile: 'thought-for-thought' },
    RWEBSTER: {
      id: 'RWEBSTER',
      name: 'RWebster',
      language: 'en',
      readingProfile: 'word-for-word',
    },
    RV1895: { id: 'RV1895', name: 'RV1895', language: 'en', readingProfile: 'word-for-word' },
    BHG: { id: 'BHG', name: 'Hebrew & Greek', language: 'he-grc', readingProfile: null },
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
      undefined,
      'offlineSetup.section.otherLanguages',
    ])
    expect(sections[0]?.options.map(option => option.id)).toEqual([
      'bible:LSG',
      'bible:DBY',
      'bible:DBR',
    ])
    expect(sections[0]?.options[0]?.required).toBe(true)
    expect(sections[1]?.options.map(option => option.id)).toEqual(
      expect.arrayContaining(['bible:ASV', 'bible:KJV', 'bible:RLT'])
    )
    expect(sections.slice(0, -1).flatMap(section => section.options)).toHaveLength(3)
    expect(sections.at(-1)?.options).toHaveLength(9)
    expect(sections.at(-1)?.options.every(option => option.language === 'en')).toBe(true)
    expect(sections.at(-1)?.collapsedByDefault).toBe(true)
    expect(options.filter(option => option.id === 'bible:LSG')).toHaveLength(1)
  })

  it('pins KJV above every section for English without duplicating it', () => {
    const sections = getOfflineSetupFolderSections('read-bible', 'en')
    const options = sections.flatMap(section => section.options)

    expect(sections[0]?.titleKey).toBeUndefined()
    expect(sections[0]?.options[0]?.id).toBe('bible:KJV')
    expect(sections[0]?.options[0]?.required).toBe(true)
    expect(options.filter(option => option.id === 'bible:KJV')).toHaveLength(1)
  })

  it('uses the default Strong Bible catalog sections and ordering', () => {
    const sections = getOfflineSetupFolderSections('understand-words', 'en')

    expect(sections.map(section => section.titleKey)).toEqual([
      undefined,
      'offlineSetup.section.otherLanguages',
    ])
    expect(sections[0]?.options.slice(0, 4).map(option => option.id)).toEqual([
      'strong-lexicon:core',
      'bible-strong:ASV',
      'bible-strong:DARBY',
      'bible-strong:KJV',
    ])
    expect(sections.at(-1)?.collapsedByDefault).toBe(true)
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
    expect(sections.map(section => section.id)).toEqual(['resources', 'other-languages'])
    expect(sections[0]?.options.map(option => option.id)).toEqual(
      expect.arrayContaining(['database:TRESOR:fr', 'strong-lexicon:entities'])
    )
    expect(sections[1]?.collapsedByDefault).toBe(true)
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

  it.each([
    ['fr', 'en'],
    ['en', 'fr'],
  ] as const)(
    "collapses the %s interface's other-language interlinear option",
    (lang, otherLang) => {
      const sections = getOfflineSetupFolderSections('original-languages', lang)
      const resources = sections.find(section => section.id === 'resources')
      const otherLanguages = sections.find(section => section.id === 'other-languages')

      expect(resources?.titleKey).toBeUndefined()
      expect(resources?.options.map(option => option.id)).toEqual(
        expect.arrayContaining([
          'bible:BHG',
          'strong-lexicon:core',
          'strong-lexicon:resources',
          `bible-interlinear:${lang}`,
        ])
      )
      expect(otherLanguages?.collapsedByDefault).toBe(true)
      expect(otherLanguages?.options.map(option => option.id)).toEqual([
        `bible-interlinear:${otherLang}`,
      ])
    }
  )

  it.each(['read-bible', 'understand-words', 'explore-bible', 'original-languages'] as const)(
    'keeps only Other languages as a titled section in %s',
    folderId => {
      const sections = getOfflineSetupFolderSections(folderId, 'fr')

      expect(sections.filter(section => section.titleKey).map(section => section.titleKey)).toEqual(
        ['offlineSetup.section.otherLanguages']
      )
    }
  )
})
