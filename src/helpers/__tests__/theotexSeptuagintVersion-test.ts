/* eslint-disable import/first */
jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
}))

jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

import { getBibleVersionCanonId, getBibleVersionVersificationId, versions } from '../bibleVersions'

describe('ThéoTeX Septuagint versions', () => {
  it('registers LXX with the complete ThéoTeX canon', () => {
    expect(versions.LXX).toMatchObject({
      canonId: 'theotex-septuagint',
      versificationId: 'theotex-septuagint',
      sourceUrl: expect.stringContaining('theotex.org'),
    })
    expect(getBibleVersionCanonId('LXX')).toBe('theotex-septuagint')
    expect(getBibleVersionVersificationId('LXX')).toBe('theotex-septuagint')
  })

  it('leaves the already-finalized LXX_FR metadata unchanged', () => {
    expect(versions.LXX_FR.canonId).toBeUndefined()
    expect(versions.LXX_FR.versificationId).toBeUndefined()
  })
})
