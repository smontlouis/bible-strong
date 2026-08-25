import { normalizeStrongRouteIdentity } from '../strongRouteIdentity'

describe('normalizeStrongRouteIdentity', () => {
  it.each([
    [
      { book: 49, reference: '5547' },
      { kind: 'strong', code: 'G5547' },
    ],
    [
      { book: 1, reference: '3651C' },
      { kind: 'dstrong', code: 'H3651C' },
    ],
    [
      { book: 1, reference: 'H3651C' },
      { kind: 'dstrong', code: 'H3651C' },
    ],
    [
      { book: 1, reference: 'H0310B' },
      { kind: 'dstrong', code: 'H0310B' },
    ],
  ] as const)('opens legacy and full study Strong references', (context, expected) => {
    expect(normalizeStrongRouteIdentity(context)).toEqual(expected)
  })
})
