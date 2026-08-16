import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import type { ResourceDatabase } from './types'

export type LocalDatabaseConfig = {
  connectionString: string
  maxConnections?: number
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
