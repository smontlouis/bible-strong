import {
  collectStrongSelectionMorphologies,
  createStrongSelection,
  getStrongSelectionMorphologyCodes,
  getStrongSelectionPayload,
} from '../strongSelection'

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

  it('associates contextual morphology with each displayed Strong identity', () => {
    const identities = [
      { kind: 'dstrong' as const, code: 'H3068G' },
      { kind: 'strong' as const, code: 'H0413' },
    ]
    const morphologies = collectStrongSelectionMorphologies(identities, [
      {
        identities: [
          { kind: 'strong', code: 'H3068' },
          { kind: 'dstrong', code: 'H3068G' },
        ],
        morphology: 'HNp',
      },
      {
        identities: [{ kind: 'strong', code: 'H0413' }],
        morphology: 'HR',
      },
      {
        identities: [{ kind: 'strong', code: 'H0413' }],
        morphology: 'HR',
      },
    ])

    expect(morphologies).toEqual([
      { identity: { kind: 'dstrong', code: 'H3068G' }, codes: ['HNp'] },
      { identity: { kind: 'strong', code: 'H0413' }, codes: ['HR'] },
    ])
    expect(getStrongSelectionMorphologyCodes(morphologies, identities[1])).toEqual(['HR'])
  })

  it('preserves contextual morphology when creating and validating a selection', () => {
    const payload = {
      book: 1,
      identities: [
        { kind: 'dstrong' as const, code: 'H3068G' },
        { kind: 'strong' as const, code: 'H0413' },
      ],
      version: 'DBY',
      morphologies: [
        {
          identity: { kind: 'dstrong' as const, code: 'H3068G' },
          codes: [' HNp ', 'HNp'],
        },
        {
          identity: { kind: 'strong' as const, code: 'H0413' },
          codes: ['HR'],
        },
      ],
    }

    expect(
      createStrongSelection(payload.identities, payload.book, payload.version, {
        morphologies: payload.morphologies,
      })
    ).toEqual({
      book: 1,
      reference: '3068',
      identities: payload.identities,
      version: 'DBY',
      morphologies: [
        { identity: { kind: 'dstrong', code: 'H3068G' }, codes: ['HNp'] },
        { identity: { kind: 'strong', code: 'H0413' }, codes: ['HR'] },
      ],
    })
    expect(getStrongSelectionPayload(payload)).toEqual({
      book: 1,
      reference: '3068',
      identities: payload.identities,
      version: 'DBY',
      morphologies: [
        { identity: { kind: 'dstrong', code: 'H3068G' }, codes: ['HNp'] },
        { identity: { kind: 'strong', code: 'H0413' }, codes: ['HR'] },
      ],
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
