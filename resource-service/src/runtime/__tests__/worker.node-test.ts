import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { makeNeonBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { makeResourceWorkerHandler } from '../worker'

describe('Resource Worker binding', () => {
  it('constructs the same HTTP application with the Neon Kysely repository without connecting', async () => {
    const { repository, dispose } = makeNeonBibleChapterRepository({
      connectionString: 'postgresql://user:password@example.neon.tech/database',
    })
    const web = makeResourceWorkerHandler(repository)

    assert.equal(typeof web.handler, 'function')
    await dispose()
  })
})
