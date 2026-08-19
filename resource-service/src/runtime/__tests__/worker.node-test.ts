import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { makeHyperdriveDatabase } from '../../database/hyperdriveDatabase'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { makeResourceWorkerHandler } from '../worker'

describe('Resource Worker binding', () => {
  it('constructs the HTTP application with the shared Hyperdrive database without connecting', async () => {
    const database = makeHyperdriveDatabase('postgresql://user:password@example.neon.tech/database')
    const web = makeResourceWorkerHandler(makeKyselyBibleChapterRepository(database))

    assert.equal(typeof web.handler, 'function')
    await database.destroy()
  })
})
