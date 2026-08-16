import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { DatabaseFailure, tryDatabasePromise } from '../databaseEffect'

describe('Kysely Effect repository boundary', () => {
  it('returns successful Kysely promise results through Effect', async () => {
    const result = await Effect.runPromise(
      tryDatabasePromise('resource.select', () => Promise.resolve(['LSG']))
    )

    assert.deepEqual(result, ['LSG'])
  })

  it('translates driver details into a stable typed failure', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        tryDatabasePromise('resource.select', () =>
          Promise.reject(new Error('password authentication failed for secret-user'))
        )
      )
    )

    assert.ok(failure instanceof DatabaseFailure)
    assert.equal(failure.operation, 'resource.select')
    assert.equal(failure.code, 'QUERY_FAILED')
    assert.equal(failure.message, 'Database operation failed')
    assert.doesNotMatch(failure.message, /secret-user/)
  })

  it('applies opt-in retries at the Effect boundary', async () => {
    let attempts = 0

    const result = await Effect.runPromise(
      tryDatabasePromise(
        'resource.select',
        () => {
          attempts += 1
          return attempts === 1 ? Promise.reject(new Error('temporary')) : Promise.resolve('ok')
        },
        { retries: 1 }
      )
    )

    assert.equal(result, 'ok')
    assert.equal(attempts, 2)
  })

  it('turns a repository timeout into a stable typed failure', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        tryDatabasePromise(
          'resource.select',
          signal =>
            new Promise((_, reject) => {
              signal.addEventListener('abort', () => reject(signal.reason))
            }),
          { timeout: '10 millis' }
        )
      )
    )

    assert.ok(failure instanceof DatabaseFailure)
    assert.equal(failure.code, 'TIMEOUT')
  })
})
