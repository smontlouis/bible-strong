import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getTableName } from 'drizzle-orm'

import { makeLocalDatabase } from '../localDatabase'
import { makeNeonDatabase } from '../neonDatabase'
import { bibleVerses, resourcePublications } from '../schema'

describe('Resource database bindings', () => {
  it('uses Drizzle definitions for canonical PostgreSQL table names', () => {
    assert.equal(getTableName(resourcePublications), 'resource_publications')
    assert.equal(getTableName(bibleVerses), 'bible_verses')
  })

  it('constructs local and hosted Kysely dialects without changing repository types', async () => {
    const local = makeLocalDatabase({
      connectionString: 'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
      maxConnections: 1,
    })
    const hosted = makeNeonDatabase({
      connectionString: 'postgresql://user:password@example.neon.tech/database',
    })

    assert.equal(local.isTransaction, false)
    assert.equal(hosted.isTransaction, false)

    await local.destroy()
    await hosted.destroy()
  })
})
