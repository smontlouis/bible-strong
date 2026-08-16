import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'

import { makeLocalDatabase } from '../localDatabase'

const migrationDirectory = fileURLToPath(new URL('../../../drizzle', import.meta.url))

export const createIsolatedPostgres = async (connectionString: string, label: string) => {
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
    maxConnections: 4,
  })
  return {
    database,
    dispose: async () => {
      await database.destroy()
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
      await admin.end()
    },
  }
}
