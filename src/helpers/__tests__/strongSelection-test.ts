import { createStrongSelection, getStrongSelectionPayload } from '../strongSelection'

describe('strongSelection', () => {
  it('preserves every displayed Strong identity in order', () => {
    expect(createStrongSelection(['H3068G', 'H0413', 'H3068G'], 1, 'BSB')).toEqual({
      book: 1,
      reference: '3068',
      references: ['H3068G', 'H0413'],
      version: 'BSB',
    })
  })

  it('adds the testament prefix to legacy numeric Strong codes', () => {
    expect(createStrongSelection(['25'], 40, 'BHG')).toEqual({
      book: 40,
      reference: '25',
      references: ['G25'],
      version: 'BHG',
    })
  })

  it('rejects selections without a valid Strong identity', () => {
    expect(createStrongSelection(['', 'word'], 1, 'LSG')).toBeUndefined()
    expect(createStrongSelection(['H0430'], 0, 'LSG')).toBeUndefined()
    expect(createStrongSelection(['H0430'], 1, '')).toBeUndefined()
  })

  it('validates Strong selection messages crossing the DOM bridge', () => {
    expect(
      getStrongSelectionPayload({
        book: 1,
        reference: 'wrong value from the bridge',
        references: ['H3068G', 'H0413'],
        version: 'DBY',
      })
    ).toEqual({
      book: 1,
      reference: '3068',
      references: ['H3068G', 'H0413'],
      version: 'DBY',
    })
    expect(
      getStrongSelectionPayload({ book: 1, references: 'H0430', version: 'LSG' })
    ).toBeUndefined()
  })
})
