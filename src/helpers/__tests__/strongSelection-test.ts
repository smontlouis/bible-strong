import { createStrongSelection, getStrongSelectionPayload } from '../strongSelection'

describe('strongSelection', () => {
  it('preserves every displayed Strong identity in order', () => {
    expect(
      createStrongSelection(
        [
          { kind: 'dstrong', code: 'H3068G' },
          { kind: 'strong', code: 'H0413' },
          { kind: 'dstrong', code: 'H3068G' },
        ],
        1,
        'BSB'
      )
    ).toEqual({
      book: 1,
      reference: '3068',
      identities: [
        { kind: 'dstrong', code: 'H3068G' },
        { kind: 'strong', code: 'H0413' },
      ],
      version: 'BSB',
    })
  })

  it('adds the testament prefix to legacy numeric Strong codes', () => {
    expect(createStrongSelection([{ kind: 'strong', code: '25' }], 40, 'BHG')).toEqual({
      book: 40,
      reference: '25',
      identities: [{ kind: 'strong', code: 'G25' }],
      version: 'BHG',
    })
  })

  it('rejects selections without a valid Strong identity', () => {
    expect(
      createStrongSelection(
        [
          { kind: 'strong', code: '' },
          { kind: 'strong', code: 'word' },
        ],
        1,
        'LSG'
      )
    ).toBeUndefined()
    expect(createStrongSelection([{ kind: 'strong', code: 'H0430' }], 0, 'LSG')).toBeUndefined()
    expect(createStrongSelection([{ kind: 'strong', code: 'H0430' }], 1, '')).toBeUndefined()
  })

  it('validates Strong selection messages crossing the DOM bridge', () => {
    expect(
      getStrongSelectionPayload({
        book: 1,
        reference: 'wrong value from the bridge',
        identities: [
          { kind: 'dstrong', code: 'H3068G' },
          { kind: 'strong', code: 'H0413' },
        ],
        version: 'DBY',
      })
    ).toEqual({
      book: 1,
      reference: '3068',
      identities: [
        { kind: 'dstrong', code: 'H3068G' },
        { kind: 'strong', code: 'H0413' },
      ],
      version: 'DBY',
    })
    expect(
      getStrongSelectionPayload({ book: 1, identities: 'H0430', version: 'LSG' })
    ).toBeUndefined()
    expect(
      getStrongSelectionPayload({
        book: 1,
        identities: [{ kind: 'unknown', code: 'H0430' }],
        version: 'LSG',
      })
    ).toBeUndefined()
  })
})
