import { Kysely, PostgresDialect, type PostgresPool } from 'kysely'
import { Pool } from 'pg'

import type { ResourceDatabase } from './types'

/**
 * Reports how long the first connection of a pool took to open: the TCP connection to
 * Hyperdrive, the start-up message and the authentication. Later calls reuse that connection
 * and are not reported.
 */
export const reportFirstConnection = (
  pool: PostgresPool,
  report: (durationMs: number) => void
): PostgresPool => {
  let opening = false
  return {
    Client: pool.Client,
    options: pool.options,
    end: () => pool.end(),
    connect: async () => {
      if (opening) return pool.connect()
      opening = true
      const startedAt = Date.now()
      const client = await pool.connect()
      report(Date.now() - startedAt)
      return client
    },
  }
}

// One pool per request, as Cloudflare asks for Hyperdrive: a connection cannot be shared
// between two requests of a Worker, and Hyperdrive keeps the pool of connections to Neon.
export const makeHyperdriveDatabase = (
  connectionString: string,
  onFirstConnection?: (durationMs: number) => void
): Kysely<ResourceDatabase> => {
  const pool = new Pool({ connectionString, max: 1 })
  return new Kysely<ResourceDatabase>({
    dialect: new PostgresDialect({
      pool: onFirstConnection ? reportFirstConnection(pool, onFirstConnection) : pool,
    }),
  })
}
