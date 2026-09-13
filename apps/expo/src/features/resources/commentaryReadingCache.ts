import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CommentaryReadingCache } from './commentaryReadingAccess'

const PREFIX = 'commentary-reading-cache:v2:'
const INVENTORY = `${PREFIX}inventory`
const DEFAULT_LIMITS = { maxEntries: 160, maxValueBytes: 1_000_000, maxTotalBytes: 8_000_000 }
type CacheEntry = { key: string; bytes: number }
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>

/** Bounded convenience cache for excerpts, never an Offline-copy promise. */
export function createCommentaryReadingCache(
  storage: Storage,
  limits = DEFAULT_LIMITS
): CommentaryReadingCache {
  let writes = Promise.resolve()
  return {
    async read(key) {
      try {
        const value = await storage.getItem(PREFIX + key)
        return value ? JSON.parse(value) : undefined
      } catch {
        return undefined
      }
    },
    write(key, value) {
      const write = async () => {
        const serialized = JSON.stringify(value)
        const bytes = serialized.length * 2
        if (bytes > Math.min(limits.maxValueBytes, limits.maxTotalBytes)) return
        try {
          const inventory: CacheEntry[] = JSON.parse((await storage.getItem(INVENTORY)) ?? '[]')
          const next = [{ key, bytes }, ...inventory.filter(item => item.key !== key)]
          let total = next.reduce((sum, item) => sum + item.bytes, 0)
          const obsolete: CacheEntry[] = []
          while (next.length > limits.maxEntries || total > limits.maxTotalBytes) {
            const oldest = next.pop()!
            total -= oldest.bytes
            obsolete.push(oldest)
          }
          for (const item of obsolete) await storage.removeItem(PREFIX + item.key)
          await storage.setItem(PREFIX + key, serialized)
          await storage.setItem(INVENTORY, JSON.stringify(next))
        } catch {
          /* Storage failure must not fail a successful resource read. */
        }
      }
      writes = writes.then(write, write)
      return writes
    },
  }
}

export const commentaryReadingCache = createCommentaryReadingCache(AsyncStorage)
