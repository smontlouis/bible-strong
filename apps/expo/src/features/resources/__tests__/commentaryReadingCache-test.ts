import { createCommentaryReadingCache } from '../commentaryReadingCache'
jest.mock('@react-native-async-storage/async-storage', () => ({}))

function storage() {
  const data = new Map<string, string>()
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: async (key: string) => {
      data.delete(key)
    },
  }
}
it('caches measured worst-chapter sized indexes instead of silently dropping them', async () => {
  const cache = createCommentaryReadingCache(storage())
  const value = { excerptIndex: 'x'.repeat(320_000) }
  await cache.write('egw-john-1', value)
  expect(await cache.read('egw-john-1')).toEqual(value)
})
it('bounds total bytes and evicts older entries while keeping rewrites counted once', async () => {
  const cache = createCommentaryReadingCache(storage(), {
    maxEntries: 10,
    maxTotalBytes: 90,
    maxValueBytes: 80,
  })
  const value = 'x'.repeat(18)
  await cache.write('a', value)
  await cache.write('b', value)
  await cache.write('a', value)
  await cache.write('c', value)
  expect(await cache.read('b')).toBeUndefined()
  expect(await cache.read('a')).toBe(value)
  expect(await cache.read('c')).toBe(value)
})
it('does not disrupt resource reads when device storage fails', async () => {
  const cache = createCommentaryReadingCache({
    ...storage(),
    setItem: async () => {
      throw new Error('Storage full')
    },
  })
  await expect(cache.write('chapter', { excerpt: 'Preview' })).resolves.toBeUndefined()
  expect(await cache.read('chapter')).toBeUndefined()
})
