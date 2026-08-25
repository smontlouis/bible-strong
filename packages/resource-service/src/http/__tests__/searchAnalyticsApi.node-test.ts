import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import type { SanitizedSearchAnalyticsEvent } from '../../analytics/searchAnalytics'
import { makeResourceWebHandler } from '../app'

describe('v1 search analytics API', () => {
  it('validates, sanitizes, and records a search event', async () => {
    let recorded: SanitizedSearchAnalyticsEvent | undefined
    const web = makeResourceWebHandler(undefined, undefined, {
      searchAnalytics: {
        record: event => {
          recorded = event
          return Effect.void
        },
      },
    })

    try {
      const response = await web.handler(
        new Request('http://localhost/v1/search-events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            event: 'search_performed',
            query: '  Grâce pour jean@example.com  ',
            language: 'fr',
            origin: 'typed',
            inputKind: 'natural_language',
            sources: ['passages', 'strong'],
            versionIds: ['LSG'],
            outcome: 'success',
            resultCounts: {
              total: 22,
              references: 0,
              passages: 20,
              strong: 2,
              dictionary: 0,
              nave: 0,
            },
            matchKind: 'semantic',
            topicId: 'topic:grace',
            durationMs: 250,
          }),
        })
      )

      assert.equal(response.status, 202)
      assert.deepEqual(await response.json(), { accepted: true })
      assert.equal(recorded?.query, 'Grâce pour [email]')
      assert.equal(recorded?.queryKey, 'grace pour [email]')
    } finally {
      await web.dispose()
    }
  })

  it('rejects an invalid payload', async () => {
    const web = makeResourceWebHandler()
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/search-events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: 'anxiété' }),
        })
      )
      assert.equal(response.status, 400)
    } finally {
      await web.dispose()
    }
  })
})
