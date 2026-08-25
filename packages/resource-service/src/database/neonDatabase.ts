import { neon } from '@neondatabase/serverless'
import { Kysely } from 'kysely'
import { NeonDialect } from 'kysely-neon'

import type { ResourceDatabase } from './types'

export type NeonDatabaseConfig = {
  connectionString: string
}

export const makeNeonDatabase = ({
  connectionString,
}: NeonDatabaseConfig): Kysely<ResourceDatabase> =>
  new Kysely<ResourceDatabase>({
    dialect: new NeonDialect({ neon: neon(connectionString) }),
  })
