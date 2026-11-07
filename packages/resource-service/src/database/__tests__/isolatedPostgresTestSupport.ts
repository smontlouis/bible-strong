import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'

import { makeLocalDatabase } from '../localDatabase'

const migrationDirectory = fileURLToPath(new URL('../../../drizzle', import.meta.url))

export const createIsolatedPostgres = async (
  connectionString: string,
  label: string,
  maxConnections = 4
) => {
  const databaseName = `bible_strong_${label}_${randomUUID().replaceAll('-', '')}`
  const databaseUrl = new URL(connectionString)
  databaseUrl.pathname = `/${databaseName}`
  const admin = new Pool({ connectionString, max: 1 })
  await admin.query(`CREATE DATABASE "${databaseName}"`)

  try {
    const migrations = new Pool({ connectionString: databaseUrl.toString(), max: 1 })
    try {
      const migrationFiles = (await readdir(migrationDirectory))
        .filter(file => file.endsWith('.sql'))
        .sort()
      for (const migrationFile of migrationFiles) {
        const sql = await readFile(path.join(migrationDirectory, migrationFile), 'utf8')
        for (const statement of sql.split('--> statement-breakpoint')) {
          if (statement.trim()) await migrations.query(statement)
        }
      }
    } finally {
      await migrations.end()
    }
  } catch (error) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
    await admin.end()
    throw error
  }

  const database = makeLocalDatabase({
    connectionString: databaseUrl.toString(),
    maxConnections,
  })
  return {
    database,
    connectionString: databaseUrl.toString(),
    dispose: async () => {
      await database.destroy()
      // pg-pool's end() resolves before its sockets close: a forced drop would terminate those
      // sessions, and their clients would throw after the test. Let them leave first.
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const { rows } = await admin.query<{ sessions: number }>(
          'select count(*)::int as sessions from pg_stat_activity where datname = $1',
          [databaseName]
        )
        if (!rows[0]?.sessions) break
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
      await admin.end()
    },
  }
}
