import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { makeHyperdriveDatabase } from '../../database/hyperdriveDatabase'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { enforceResourceApiAppCheck, makeResourceWorkerHandler } from '../worker'

describe('Resource Worker binding', () => {
  it('constructs the HTTP application with the shared Hyperdrive database without connecting', async () => {
    const database = makeHyperdriveDatabase('postgresql://user:password@example.neon.tech/database')
    const web = makeResourceWorkerHandler(makeKyselyBibleChapterRepository(database))

    assert.equal(typeof web.handler, 'function')
    await database.destroy()
  })

  it('requires App Check for every v1 database route before Hyperdrive access', async () => {
    const authorize = async () => false

    const bible = await enforceResourceApiAppCheck(
      new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'),
      authorize
    )
    const lexicon = await enforceResourceApiAppCheck(
      new Request('https://api.bible-strong.app/v1/strong/lexicon/G0001'),
      authorize
    )

    assert.equal(bible?.status, 401)
    assert.equal(lexicon?.status, 401)
  })

  it('does not require App Check for non-v1 operational routes', async () => {
    let authorizationCalls = 0
    const response = await enforceResourceApiAppCheck(
      new Request('https://api.bible-strong.app/health'),
      async () => {
        authorizationCalls += 1
        return false
      }
    )

    assert.equal(response, undefined)
    assert.equal(authorizationCalls, 0)
  })
})
