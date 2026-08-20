import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'

import type { ResourceDatabase } from './types'

export type LocalDatabaseConfig = {
  connectionString: string
  maxConnections?: number
}

export type LocalDatabaseAdvisoryLock = {
  release: () => Promise<void>
}

export const makeLocalDatabase = ({
  connectionString,
  maxConnections = 10,
}: LocalDatabaseConfig): Kysely<ResourceDatabase> =>
  new Kysely<ResourceDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString, max: maxConnections }),
    }),
  })

export const assertLocalDatabaseReachable = async (config: LocalDatabaseConfig): Promise<void> => {
  const database = makeLocalDatabase(config)
  try {
    await sql`select 1`.execute(database)
  } finally {
    await database.destroy()
  }
}

export const acquireLocalDatabaseAdvisoryLock = async (
  config: LocalDatabaseConfig,
  lockId: string
): Promise<LocalDatabaseAdvisoryLock | undefined> => {
  const pool = new Pool({ connectionString: config.connectionString, max: 1 })
  const client = await pool.connect()
  try {
    const result = await client.query<{ acquired: boolean }>(
      'select pg_try_advisory_lock($1::bigint) as acquired',
      [lockId]
    )
    if (!result.rows[0]?.acquired) {
      client.release()
      await pool.end()
      return undefined
    }
  } catch (cause) {
    client.release()
    await pool.end()
    throw cause
  }

  let released = false
  return {
    release: async () => {
      if (released) return
      released = true
      try {
        await client.query('select pg_advisory_unlock($1::bigint)', [lockId])
      } finally {
        client.release()
        await pool.end()
      }
    },
  }
}
