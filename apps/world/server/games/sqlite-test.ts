/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite'

/** Exercise the actual SQL against SQLite; only the Cloudflare storage wrapper is adapted. */
export function sqliteStorage(filename = ':memory:') {
  const db = new DatabaseSync(filename)
  const storage = {
    sql: {
      exec(query: string, ...bindings: (string | number | null)[]) {
        if (
          !bindings.length &&
          query
            .trim()
            .split(';')
            .filter(part => part.trim()).length > 1
        ) {
          db.exec(query)
          return { toArray: () => [] }
        }
        const rows = db.prepare(query).all(...bindings)
        return { toArray: () => rows }
      },
    },
    transactionSync<T>(callback: () => T): T {
      db.exec('BEGIN')
      try {
        const result = callback()
        db.exec('COMMIT')
        return result
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
  return {
    db,
    storage: storage as unknown as Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  }
}
