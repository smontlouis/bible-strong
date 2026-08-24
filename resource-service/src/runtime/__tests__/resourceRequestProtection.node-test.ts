import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { protectResourceRequest, type ResourceRateLimitBinding } from '../resourceRequestProtection'

const rejectedLimiter = (keys: string[]): ResourceRateLimitBinding => ({
  async limit({ key }) {
    keys.push(key)
    return { success: false }
  },
})

const acceptedLimiter = (calls: string[], name: string): ResourceRateLimitBinding => ({
  async limit() {
    calls.push(name)
    return { success: true }
  },
})

describe('Resource request protection', () => {
  it('rejects an attested Bible-reading burst before protected work', async () => {
    const events: string[] = []
    const keys: string[] = []
    const request = new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
      headers: {
        'x-firebase-appcheck': 'verified-app-check-token',
        'x-request-id': 'reading_burst',
      },
    })

    const response = await protectResourceRequest({
      request,
      authorize: async () => {
        events.push('authorized')
        return true
      },
      limiters: {
        reading: rejectedLimiter(keys),
        search: rejectedLimiter([]),
        artifact: rejectedLimiter([]),
      },
      reportLimited: category => events.push(`limited:${category}`),
    })

    assert.equal(response?.status, 429)
    assert.equal(response?.headers.get('retry-after'), '60')
    assert.equal(response?.headers.get('cache-control'), 'private, no-store')
    assert.equal(response?.headers.get('content-type'), 'application/json')
    assert.equal(response?.headers.get('x-request-id'), 'reading_burst')
    assert.deepEqual(await response?.json(), {
      _tag: 'ResourceRateLimitedProblem',
      type: 'https://bible-strong.app/problems/resource-rate-limited',
      title: 'Resource request rate limited',
      detail: 'Too many resource requests. Retry after 60 seconds.',
      requestId: 'reading_burst',
      status: 429,
      code: 'RESOURCE_RATE_LIMITED',
      retryAfterSeconds: 60,
    })
    assert.deepEqual(events, ['authorized', 'limited:reading'])
    assert.equal(keys.length, 1)
    assert.match(keys[0], /^[a-f0-9]{64}$/)
    assert.equal(keys[0].includes('verified-app-check-token'), false)
  })

  it('uses the stricter search counter for search and random routes', async () => {
    const calls: string[] = []
    const limiters = {
      reading: acceptedLimiter(calls, 'reading'),
      search: acceptedLimiter(calls, 'search'),
      artifact: acceptedLimiter(calls, 'artifact'),
    }

    const search = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/LSG/search?q=grace', {
        headers: { 'x-firebase-appcheck': 'search-token' },
      }),
      authorize: async () => true,
      limiters,
    })
    const random = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/strong-lexicon/entries/random', {
        headers: { 'x-firebase-appcheck': 'random-token' },
      }),
      authorize: async () => true,
      limiters,
    })
    const analytics = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/search-events', {
        method: 'POST',
        headers: { 'x-firebase-appcheck': 'analytics-token' },
      }),
      authorize: async () => true,
      limiters,
    })

    assert.equal(search, undefined)
    assert.equal(random, undefined)
    assert.equal(analytics, undefined)
    assert.deepEqual(calls, ['search', 'search', 'search'])
  })

  it('limits an attested R2 range request with the artifact counter', async () => {
    const calls: string[] = []
    const response = await protectResourceRequest({
      request: new Request(
        'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip',
        {
          headers: {
            'x-firebase-appcheck': 'artifact-token',
            range: 'bytes=10-20',
          },
        }
      ),
      authorize: async () => true,
      limiters: {
        reading: acceptedLimiter(calls, 'reading'),
        search: acceptedLimiter(calls, 'search'),
        artifact: rejectedLimiter(calls),
      },
    })

    assert.equal(response?.status, 429)
    assert.equal(response?.headers.get('retry-after'), '60')
    assert.equal(calls.length, 1)
    assert.match(calls[0], /^[a-f0-9]{64}$/)
  })

  it('rejects missing attestation before every limiter', async () => {
    const calls: string[] = []
    const response = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/naves/fr/topics'),
      authorize: async () => false,
      limiters: {
        reading: acceptedLimiter(calls, 'reading'),
        search: acceptedLimiter(calls, 'search'),
        artifact: acceptedLimiter(calls, 'artifact'),
      },
    })

    assert.equal(response?.status, 401)
    assert.deepEqual(calls, [])
  })

  it('keeps the public offline catalog outside attestation and application counters', async () => {
    let authorizationCalls = 0
    const limiterCalls: string[] = []
    const response = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/offline-catalog'),
      authorize: async () => {
        authorizationCalls += 1
        return false
      },
      limiters: {
        reading: acceptedLimiter(limiterCalls, 'reading'),
        search: acceptedLimiter(limiterCalls, 'search'),
        artifact: acceptedLimiter(limiterCalls, 'artifact'),
      },
    })

    assert.equal(response, undefined)
    assert.equal(authorizationCalls, 0)
    assert.deepEqual(limiterCalls, [])
  })

  it('fails open with a sanitized report when Cloudflare counters are unavailable', async () => {
    const failures: { category: string; message: string }[] = []
    const response = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/dictionaries/fr/entries/grace', {
        headers: { 'x-firebase-appcheck': 'dictionary-token' },
      }),
      authorize: async () => true,
      limiters: {
        reading: {
          async limit() {
            throw new Error('RATE_LIMIT_BINDING_UNAVAILABLE')
          },
        },
        search: acceptedLimiter([], 'search'),
        artifact: acceptedLimiter([], 'artifact'),
      },
      reportFailure: (category, _requestId, cause) =>
        failures.push({
          category,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    })

    assert.equal(response, undefined)
    assert.deepEqual(failures, [{ category: 'reading', message: 'RATE_LIMIT_BINDING_UNAVAILABLE' }])
  })
})
