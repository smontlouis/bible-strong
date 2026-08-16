import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'

import { makeLocalDatabase } from '../localDatabase'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Persistent local PostgreSQL', { skip: !runIntegration }, () => {
  it('retains migrated data across a non-destructive container restart', async () => {
    const identity = `foundation-test:${randomUUID()}`
    const firstConnection = makeLocalDatabase({ connectionString, maxConnections: 1 })

    await firstConnection
      .insertInto('resource_publications')
      .values({
        resource_identity: identity,
        resource_kind: 'foundation-test',
        revision: '1',
        language: null,
        canonical_sha256: '0'.repeat(64),
        offline_artifact_sha256: '1'.repeat(64),
        provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
        rights: { holder: 'integration-test', online: false, offline: false },
        metadata: {},
      })
      .executeTakeFirstOrThrow()
    await firstConnection.destroy()

    if (process.env.RESOURCE_EXTERNAL_POSTGRES !== '1') {
      const restart = spawnSync(
        'docker',
        ['compose', '-f', 'resource-service/compose.yaml', 'restart', 'postgres'],
        { cwd: process.cwd(), encoding: 'utf8' }
      )
      assert.equal(restart.status, 0, restart.stderr)

      const ready = spawnSync(
        'docker',
        ['compose', '-f', 'resource-service/compose.yaml', 'up', '-d', '--wait'],
        { cwd: process.cwd(), encoding: 'utf8' }
      )
      assert.equal(ready.status, 0, ready.stderr)
    }

    const secondConnection = makeLocalDatabase({ connectionString, maxConnections: 1 })
    try {
      const publication = await secondConnection
        .selectFrom('resource_publications')
        .select(['resource_identity', 'revision'])
        .where('resource_identity', '=', identity)
        .executeTakeFirst()

      assert.deepEqual(publication, { resource_identity: identity, revision: '1' })
    } finally {
      await secondConnection
        .deleteFrom('resource_publications')
        .where('resource_identity', 'like', 'foundation-test:%')
        .execute()
      await secondConnection.destroy()
    }
  })
})
