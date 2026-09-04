import { getHistoryStrongReference } from '../historyStrongReference'

describe('getHistoryStrongReference', () => {
  it('uses the modern persisted reference', () => {
    expect(getHistoryStrongReference({ reference: 'G4074G' })).toBe('G4074G')
  })

  it('keeps older persisted Code entries readable', () => {
    expect(getHistoryStrongReference({ Code: 4074 })).toBe('4074')
  })

  it('prefers the modern reference when both formats are present', () => {
    expect(getHistoryStrongReference({ reference: 'G4074G', Code: 4074 })).toBe('G4074G')
  })
})
