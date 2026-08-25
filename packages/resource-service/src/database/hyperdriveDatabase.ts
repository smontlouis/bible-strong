import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import type { ResourceDatabase } from './types'

export const makeHyperdriveDatabase = (connectionString: string): Kysely<ResourceDatabase> =>
  new Kysely<ResourceDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString, max: 1 }),
    }),
  })
