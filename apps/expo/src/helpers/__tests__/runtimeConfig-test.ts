import { isEnvironmentFlagEnabled } from '../environmentFlags'

describe('runtime environment flags', () => {
  it('accepts the common truthy values used by local env files', () => {
    expect(isEnvironmentFlagEnabled('true')).toBe(true)
    expect(isEnvironmentFlagEnabled(' 1 ')).toBe(true)
    expect(isEnvironmentFlagEnabled('YES')).toBe(true)
    expect(isEnvironmentFlagEnabled('on')).toBe(true)
  })

  it('keeps missing and false-like values disabled', () => {
    expect(isEnvironmentFlagEnabled(undefined)).toBe(false)
    expect(isEnvironmentFlagEnabled('false')).toBe(false)
    expect(isEnvironmentFlagEnabled('0')).toBe(false)
    expect(isEnvironmentFlagEnabled('')).toBe(false)
  })
})
