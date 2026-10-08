import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInstanceCache } from './instanceCache'

afterEach(() => {
  vi.useRealTimers()
})

describe('createInstanceCache', () => {
  it('shares a read in flight between the pages that ask for it', async () => {
    const cached = createInstanceCache<string>(1000)
    const read = vi.fn(async () => 'coverage')

    expect(await Promise.all([cached('LSG', read), cached('LSG', read)])).toEqual([
      'coverage',
      'coverage',
    ])
    expect(await cached('LSG', read)).toBe('coverage')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('reads each key on its own', async () => {
    const cached = createInstanceCache<string>(1000)
    expect(await cached('LSG', async () => 'one')).toBe('one')
    expect(await cached('KJV', async () => 'two')).toBe('two')
  })

  it('reads again once the answer is older than it may be', async () => {
    vi.useFakeTimers()
    const cached = createInstanceCache<number>(1000)
    let answers = 0
    const read = async () => (answers += 1)

    expect(await cached('LSG', read)).toBe(1)
    vi.advanceTimersByTime(999)
    expect(await cached('LSG', read)).toBe(1)
    vi.advanceTimersByTime(1)
    expect(await cached('LSG', read)).toBe(2)
  })

  it('keeps neither an absent answer nor a failed read', async () => {
    const cached = createInstanceCache<string>(1000)
    expect(await cached('LSG', async () => undefined)).toBeUndefined()
    await expect(cached('LSG', () => Promise.reject(new Error('429')))).rejects.toThrow('429')
    expect(await cached('LSG', async () => 'coverage')).toBe('coverage')
  })
})
