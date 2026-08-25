import { getPersistedStudyStrongReference } from '../strongStudyReference'

describe('getPersistedStudyStrongReference', () => {
  it.each([
    [{ codeStrong: 5547 }, '5547'],
    [{ codeStrong: '5547' }, '5547'],
    [{ code: '5547' }, '5547'],
    [{ codeStrong: 'H3651C' }, 'H3651C'],
  ])('reads current and legacy study Strong payloads', (payload, expected) => {
    expect(getPersistedStudyStrongReference(payload)).toBe(expected)
  })
})
