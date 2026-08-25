import { getBibleVersionCanonId, getBibleVersionVersificationId, versions } from '../bibleVersions'

jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
}))

jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

describe('Catholic Bible versions', () => {
  it.each(['BFC', 'FRC97', 'NFC', 'PDV2017'])(
    'exposes the deuterocanonical canon for %s',
    versionId => {
      expect(versions[versionId]?.canonId).toBe('catholic-73')
      expect(getBibleVersionCanonId(versionId)).toBe('catholic-73')
      expect(getBibleVersionVersificationId(versionId)).toBe('bible-strong-default')
    }
  )

  it('declares Crampon extended Esther and Daniel explicitly', () => {
    expect(getBibleVersionCanonId('BCC1923')).toBe('catholic-73')
    expect(getBibleVersionVersificationId('BCC1923')).toBe(
      'bible-strong-catholic-extended-esther-daniel'
    )
  })

  it('does not change the canon of unrelated editions', () => {
    expect(getBibleVersionCanonId('LSG')).toBe('protestant-66')
    expect(getBibleVersionCanonId('VUL')).toBe('clementine-vulgate')
  })
})
