import { getBibleDefaultCatalog } from '~features/bible/bibleDefaultCatalog'
import { versions } from '~helpers/bibleVersions'

jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
}))

jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

describe('Bible default catalogs', () => {
  it('contains no removed runtime Bible identity', () => {
    const removedIds = ['LSGS', 'KJVS', 'INT', 'INT_EN']

    expect(Object.keys(versions)).toEqual(expect.not.arrayContaining(removedIds))
    expect(getBibleDefaultCatalog('reading').map(version => version.id)).toEqual(
      expect.not.arrayContaining(removedIds)
    )
    expect(getBibleDefaultCatalog('strong').map(version => version.id)).toEqual(
      expect.not.arrayContaining(removedIds)
    )
  })

  it('offers visible French and English Bibles for the reading default', () => {
    const catalog = getBibleDefaultCatalog('reading')

    expect(catalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'LSG', language: 'fr' }),
        expect.objectContaining({ id: 'KJV', language: 'en' }),
      ])
    )
    expect(catalog.every(version => !version.hidden)).toBe(true)
    expect(catalog.every(version => version.language === 'fr' || version.language === 'en')).toBe(
      true
    )
  })

  it('only offers Bibles backed by a Strong publication for the Strong default', () => {
    const catalogIds = getBibleDefaultCatalog('strong').map(version => version.id)

    expect(catalogIds).toEqual([
      'LSG',
      'DBY',
      'DBR',
      'KJV',
      'NASB2020',
      'NASB1995',
      'BSB',
      'ASV',
      'DARBY',
      'RLT',
      'RWEBSTER',
      'RV1895',
    ])
    expect(catalogIds).not.toContain('BFC')
  })
})
