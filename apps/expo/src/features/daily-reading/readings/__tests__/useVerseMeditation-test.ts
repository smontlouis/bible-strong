jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'fr' } }) }))
jest.mock('../useDailyReadings', () => ({ useDailyEntry: jest.fn() }))
jest.mock('../useVerseSwap', () => ({ useVerseSwap: jest.fn() }))

import { getVerseKeys } from '../useVerseMeditation'

describe('getVerseKeys', () => {
  it('locates one verse', () => {
    expect(getVerseKeys('MAT.5.6')).toEqual(['40-5-6'])
  })

  it('lists every verse of a passage', () => {
    expect(getVerseKeys('PSA.103.1-2')).toEqual(['19-103-1', '19-103-2'])
    expect(getVerseKeys('PSA.103.1–3')).toEqual(['19-103-1', '19-103-2', '19-103-3'])
  })

  it('reads nothing from an unknown book or a broken reference', () => {
    expect(getVerseKeys('XYZ.1.1')).toEqual([])
    expect(getVerseKeys('MAT.5')).toEqual([])
    expect(getVerseKeys('MAT.5.6-2')).toEqual([])
  })
})
