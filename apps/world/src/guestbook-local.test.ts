import { describe, expect, it } from 'vitest'
import { readSignature, rememberSignature } from './guestbook-local'

describe('local avatar signature', () => {
  it('remembers publication across reopening regardless of avatar appearance or name', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
    }
    expect(readSignature(storage)).toBeNull()
    rememberSignature('published-entry', storage)
    expect(readSignature({ getItem: storage.getItem })).toBe('published-entry')
    data.clear()
    expect(readSignature(storage)).toBeNull()
  })
  it('does not crash when storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readSignature(storage)).toBeNull()
    expect(() => rememberSignature('published-entry', storage)).not.toThrow()
  })
})
