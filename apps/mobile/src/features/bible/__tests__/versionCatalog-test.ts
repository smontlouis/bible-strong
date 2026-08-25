import { versions } from '~helpers/bibleVersions'
import {
  filterVersionCatalogByAvailability,
  getVersionCatalogLocation,
  getVersionCatalogSections,
  type VersionCatalogLabels,
} from '../versionCatalog'
import { migrateBibleVersionGrouping } from '../versionCatalogState'

jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
}))

jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

jest.mock('~helpers/atomWithAsyncStorage', () => jest.fn(() => ({})))

describe('Bible version catalog metadata', () => {
  it('classifies every current version with the approved language and reading profile', () => {
    const expectedLanguages = {
      fr: [
        'LSG',
        'NBS',
        'NEG79',
        'NVS78P',
        'S21',
        'KJF',
        'DBY',
        'DBR',
        'OST',
        'CHU',
        'BDS',
        'FMAR',
        'LAU',
        'BFC',
        'FRC97',
        'NFC',
        'BCC1923',
        'PDV2017',
        'POV',
        'LXX_FR',
      ],
      en: [
        'KJV',
        'BSB',
        'ASV',
        'DARBY',
        'RLT',
        'RWEBSTER',
        'RV1895',
        'NKJV',
        'ESV',
        'NIV',
        'EASY',
        'TLV',
        'NASB2020',
        'NASB1995',
        'NET',
        'GW',
        'CSB',
        'NLT',
        'AMP',
      ],
      he: ['BHS', 'DEL'],
      grc: ['LXX', 'SBLGNT', 'TR1624', 'TR1894'],
      la: ['VUL'],
    } as const

    const expectedProfiles = {
      'word-for-word': [
        'LSG',
        'NBS',
        'NEG79',
        'NVS78P',
        'S21',
        'KJF',
        'DBY',
        'DBR',
        'OST',
        'CHU',
        'FMAR',
        'LAU',
        'BCC1923',
        'LXX_FR',
        'KJV',
        'ASV',
        'DARBY',
        'RLT',
        'RWEBSTER',
        'RV1895',
        'NKJV',
        'ESV',
        'TLV',
        'NASB1995',
        'NASB2020',
        'AMP',
      ],
      balanced: ['BSB', 'NIV', 'NET', 'GW', 'CSB'],
      'thought-for-thought': ['BDS', 'BFC', 'FRC97', 'NFC', 'PDV2017', 'EASY', 'NLT'],
      paraphrase: ['POV'],
      other: ['BHG', 'BHS', 'LXX', 'VUL', 'SBLGNT', 'TR1624', 'TR1894', 'DEL'],
    } as const

    expect(Object.keys(versions)).toHaveLength(47)

    for (const [language, ids] of Object.entries(expectedLanguages)) {
      expect(ids.map(id => versions[id].language)).toEqual(ids.map(() => language))
    }

    for (const [profile, ids] of Object.entries(expectedProfiles)) {
      expect(ids.map(id => versions[id].readingProfile ?? 'other')).toEqual(ids.map(() => profile))
    }
  })
})

const labels: VersionCatalogLabels = {
  languages: {
    fr: 'Français',
    en: 'Anglais',
    he: 'Hébreu',
    grc: 'Grec',
    'he-grc': 'Hébreu et Grec',
    la: 'Latin',
  },
  profiles: {
    'word-for-word': 'Mot à mot',
    balanced: 'Équilibrée',
    'thought-for-thought': 'Idée par idée',
    paraphrase: 'Paraphrase',
  },
  other: 'Autres',
}

describe('Bible version catalog query', () => {
  it('keeps only locally downloaded versions when the availability filter is active', () => {
    const catalog = [versions.LSG, versions.NIV, versions.BDS]

    expect(
      filterVersionCatalogByAvailability(catalog, 'downloaded', new Set(['LSG', 'BDS'])).map(
        version => version.id
      )
    ).toEqual(['LSG', 'BDS'])
    expect(filterVersionCatalogByAvailability(catalog, 'all', new Set()).map(v => v.id)).toEqual([
      'LSG',
      'NIV',
      'BDS',
    ])
  })

  it('combines downloaded availability, search, and grouping', () => {
    const downloadedCatalog = filterVersionCatalogByAvailability(
      [versions.LSG, versions.BDS, versions.NLT],
      'downloaded',
      new Set(['BDS', 'NLT'])
    )
    const sections = getVersionCatalogSections({
      catalog: downloadedCatalog,
      grouping: 'style',
      query: 'semeur',
      uiLanguage: 'fr',
      labels,
    })

    expect(sections.map(section => section.key)).toEqual(['thought-for-thought'])
    expect(sections[0].data.map(version => version.id)).toEqual(['BDS'])
  })

  it('searches all known names and codes without case or accent sensitivity', () => {
    const byName = getVersionCatalogSections({
      catalog: Object.values(versions),
      grouping: 'alphabetical',
      query: 'hebraique',
      uiLanguage: 'fr',
      labels,
    })
    const byCode = getVersionCatalogSections({
      catalog: Object.values(versions),
      grouping: 'alphabetical',
      query: 'nasb1995',
      uiLanguage: 'fr',
      labels,
    })

    expect(byName[0].data.map(version => version.id)).toEqual(['BHG'])
    expect(byCode[0].data.map(version => version.id)).toEqual(['NASB1995'])
  })

  it('returns one localized alphabetical list ordered by display name', () => {
    const sections = getVersionCatalogSections({
      catalog: [versions.VUL, versions.LAU, versions.LXX],
      grouping: 'alphabetical',
      query: '',
      uiLanguage: 'en',
      labels,
    })

    expect(sections).toHaveLength(1)
    expect(sections[0].key).toBe('alphabetical')
    expect(sections[0].title).toBe('')
    expect(sections[0].data.map(version => [version.id, version.displayName])).toEqual([
      ['VUL', 'Clementine Vulgate (Latin)'],
      ['LAU', 'Lausanne Bible 1872'],
      ['LXX', 'Septuagint (OT)'],
    ])
  })

  it('puts the Hebrew and Greek section first', () => {
    const sections = getVersionCatalogSections({
      catalog: [versions.VUL, versions.KJV, versions.LSG, versions.BHG, versions.BHS, versions.LXX],
      grouping: 'language',
      query: '',
      uiLanguage: 'fr',
      labels,
    })

    expect(sections.map(section => section.key)).toEqual(['he-grc', 'fr', 'en', 'grc', 'he', 'la'])
    expect(sections.map(section => section.title)).toEqual([
      'Hébreu et Grec',
      'Français',
      'Anglais',
      'Grec',
      'Hébreu',
      'Latin',
    ])
  })

  it('keeps the Hebrew and Greek section first when English is the app language', () => {
    const sections = getVersionCatalogSections({
      catalog: [versions.LSG, versions.KJV, versions.BHG, versions.VUL],
      grouping: 'language',
      query: '',
      uiLanguage: 'en',
      labels,
    })

    expect(sections.map(section => section.key)).toEqual(['he-grc', 'en', 'fr', 'la'])
  })

  it('orders style sections by the approved spectrum and collects null profiles under Other', () => {
    const sections = getVersionCatalogSections({
      catalog: [versions.POV, versions.BHG, versions.NIV, versions.BDS, versions.LSG],
      grouping: 'style',
      query: '',
      uiLanguage: 'fr',
      labels,
    })

    expect(sections.map(section => section.key)).toEqual([
      'word-for-word',
      'balanced',
      'thought-for-thought',
      'paraphrase',
      'other',
    ])
    expect(sections.map(section => section.data[0].id)).toEqual(['LSG', 'NIV', 'BDS', 'POV', 'BHG'])
  })

  it('applies search inside the active grouping and removes empty sections', () => {
    const sections = getVersionCatalogSections({
      catalog: [versions.LSG, versions.NIV, versions.BDS, versions.POV, versions.BHG],
      grouping: 'style',
      query: 'semeur',
      uiLanguage: 'fr',
      labels,
    })

    expect(sections.map(section => section.key)).toEqual(['thought-for-thought'])
    expect(sections[0].data.map(version => version.id)).toEqual(['BDS'])
  })

  it('returns no sections when the search has no result', () => {
    expect(
      getVersionCatalogSections({
        catalog: Object.values(versions),
        grouping: 'language',
        query: 'does-not-exist',
        uiLanguage: 'fr',
        labels,
      })
    ).toEqual([])
  })

  it('locates a selected version in the visible section model', () => {
    const sections = getVersionCatalogSections({
      catalog: [versions.LSG, versions.KJV, versions.VUL],
      grouping: 'language',
      query: '',
      uiLanguage: 'fr',
      labels,
    })

    expect(getVersionCatalogLocation(sections, 'KJV')).toEqual({ sectionIndex: 1, itemIndex: 0 })
    expect(getVersionCatalogLocation(sections, 'NASB1995')).toBeNull()
  })
})

describe('Bible version grouping preference', () => {
  it('uses one local persisted preference with language as its initial value', () => {
    const atomWithAsyncStorageMock = jest.requireMock(
      '../../../helpers/atomWithAsyncStorage'
    ) as jest.Mock

    expect(atomWithAsyncStorageMock).toHaveBeenCalledWith(
      'bibleVersionGrouping.v1',
      'language',
      expect.objectContaining({ migrate: migrateBibleVersionGrouping })
    )
  })

  it('preserves valid persisted groupings and repairs invalid values to language', () => {
    expect(migrateBibleVersionGrouping('alphabetical')).toBe('alphabetical')
    expect(migrateBibleVersionGrouping('style')).toBe('style')
    expect(migrateBibleVersionGrouping('unknown')).toBe('language')
    expect(migrateBibleVersionGrouping(null)).toBe('language')
  })
})
