import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ResourceRateLimitedProblem } from '../../http/problems'
import {
  protectResourceOriginRead,
  protectResourceRequest,
  type ResourceRateLimitBinding,
  type ResourceRateLimitCategory,
} from '../resourceRequestProtection'

const androidAppId = '1:204116128917:android:3ae4e716f079e5a002579c'
const webAppId = '1:204116128917:web:6ec6a6562ad7957402579c'

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

const limitersFrom = (
  overrides: Partial<Record<ResourceRateLimitCategory, ResourceRateLimitBinding>>,
  calls: string[] = []
): Record<ResourceRateLimitCategory, ResourceRateLimitBinding> => ({
  reading: acceptedLimiter(calls, 'reading'),
  search: acceptedLimiter(calls, 'search'),
  'semantic-search': acceptedLimiter(calls, 'semantic-search'),
  artifact: acceptedLimiter(calls, 'artifact'),
  'encrypted-artifact': acceptedLimiter(calls, 'encrypted-artifact'),
  ...overrides,
})

describe('Resource request protection', () => {
  it('rejects a Bible-reading burst per client address without consulting App Check', async () => {
    const events: string[] = []
    const keys: string[] = []
    const request = new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
      headers: {
        'cf-connecting-ip': '203.0.113.7',
        'x-firebase-appcheck': 'ignored-app-check-token',
        'x-request-id': 'reading_burst',
      },
    })

    const response = await protectResourceRequest({
      request,
      authorize: async () => {
        events.push('authorized')
        return androidAppId
      },
      limiters: limitersFrom({ reading: rejectedLimiter(keys) }),
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
    assert.deepEqual(events, ['limited:reading'])
    assert.deepEqual(keys, ['address:203.0.113.7'])
  })

  it('uses the dedicated search counter for search and random routes', async () => {
    const calls: string[] = []
    const limiters = limitersFrom({}, calls)

    const search = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/LSG/search?q=grace', {
        headers: { 'x-firebase-appcheck': 'search-token' },
      }),
      authorize: async () => androidAppId,
      limiters,
    })
    const random = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/strong-lexicon/entries/random', {
        headers: { 'x-firebase-appcheck': 'random-token' },
      }),
      authorize: async () => androidAppId,
      limiters,
    })
    const analytics = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/search-events', {
        method: 'POST',
        headers: { 'x-firebase-appcheck': 'analytics-token' },
      }),
      authorize: async () => androidAppId,
      limiters,
    })

    assert.equal(search, undefined)
    assert.equal(random, undefined)
    assert.equal(analytics, undefined)
    assert.deepEqual(calls, ['search', 'search', 'search'])
  })

  it('uses the dedicated semantic-search counter for routes that call Workers AI', async () => {
    const calls: string[] = []
    const limiters = limitersFrom({}, calls)

    const one = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/LSG/semantic-search?q=grace'),
      authorize: async () => undefined,
      limiters,
    })
    const many = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/semantic-search?q=grace'),
      authorize: async () => undefined,
      limiters,
    })

    assert.equal(one, undefined)
    assert.equal(many, undefined)
    assert.deepEqual(calls, ['semantic-search', 'semantic-search'])
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
      authorize: async () => androidAppId,
      limiters: limitersFrom({ artifact: rejectedLimiter(calls) }, calls),
    })

    assert.equal(response?.status, 429)
    assert.equal(response?.headers.get('retry-after'), '60')
    assert.equal(calls.length, 1)
    assert.match(calls[0], /^[a-f0-9]{64}$/)
  })

  it('forbids Offline-copy downloads to a valid Web attestation before every limiter', async () => {
    const calls: string[] = []
    const forbidden: string[] = []
    const response = await protectResourceRequest({
      request: new Request(
        'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip',
        { headers: { 'x-firebase-appcheck': 'web-token', 'x-request-id': 'web_artifact' } }
      ),
      authorize: async () => webAppId,
      limiters: limitersFrom({}, calls),
      reportForbidden: (category, requestId, appId) =>
        forbidden.push(`${category}:${requestId}:${appId}`),
    })

    assert.equal(response?.status, 403)
    assert.equal(response?.body, null)
    assert.equal(response?.headers.get('cache-control'), 'private, no-store')
    assert.equal(response?.headers.get('x-request-id'), 'web_artifact')
    assert.deepEqual(calls, [])
    assert.deepEqual(forbidden, [`artifact:web_artifact:${webAppId}`])
  })

  it('serves Online reading and search without an App Check token', async () => {
    const calls: string[] = []
    let authorizationCalls = 0
    const limiters = limitersFrom({}, calls)
    const authorize = async () => {
      authorizationCalls += 1
      return undefined
    }

    const reading = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/naves/fr/topics'),
      authorize,
      limiters,
    })
    const search = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/LSG/search?q=grace', {
        headers: { 'x-firebase-appcheck': 'expired-or-invalid-token' },
      }),
      authorize,
      limiters,
    })

    assert.equal(reading, undefined)
    assert.equal(search, undefined)
    assert.equal(authorizationCalls, 0)
    assert.deepEqual(calls, ['reading', 'search'])
  })

  it('serves encrypted Offline copies without App Check, counted per client address', async () => {
    const keys: string[] = []
    let authorizationCalls = 0
    const response = await protectResourceRequest({
      request: new Request(
        'https://api.bible-strong.app/v1/offline-archives/bibles/bible-lsg.json.encrypted.zip?sha256=' +
          'a'.repeat(64),
        { headers: { 'cf-connecting-ip': '198.51.100.4', range: 'bytes=0-99' } }
      ),
      authorize: async () => {
        authorizationCalls += 1
        return undefined
      },
      limiters: limitersFrom({ 'encrypted-artifact': rejectedLimiter(keys) }),
    })

    assert.equal(response?.status, 429)
    assert.equal(authorizationCalls, 0)
    assert.deepEqual(keys, ['address:198.51.100.4'])
  })

  it('rejects an Offline-copy download without attestation before every limiter', async () => {
    const calls: string[] = []
    const response = await protectResourceRequest({
      request: new Request(
        'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip'
      ),
      authorize: async () => undefined,
      limiters: limitersFrom({}, calls),
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
        return undefined
      },
      limiters: limitersFrom({}, limiterCalls),
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
      authorize: async () => androidAppId,
      limiters: limitersFrom({
        reading: {
          async limit() {
            throw new Error('RATE_LIMIT_BINDING_UNAVAILABLE')
          },
        },
      }),
      reportFailure: (category, _requestId, cause) =>
        failures.push({
          category,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    })

    assert.equal(response, undefined)
    assert.deepEqual(failures, [{ category: 'reading', message: 'RATE_LIMIT_BINDING_UNAVAILABLE' }])
  })

  it('answers a limited request with exactly what the HTTP application encodes', async () => {
    const response = await protectResourceRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
        headers: { 'x-request-id': 'limited_body' },
      }),
      authorize: async () => undefined,
      limiters: limitersFrom({ reading: rejectedLimiter([]) }),
    })

    // The body is written without the problem class, so that Effect is not loaded with the
    // Worker. It must stay what that class produces.
    assert.equal(
      await response?.text(),
      JSON.stringify(
        new ResourceRateLimitedProblem({
          type: 'https://bible-strong.app/problems/resource-rate-limited',
          title: 'Resource request rate limited',
          detail: 'Too many resource requests. Retry after 60 seconds.',
          requestId: 'limited_body',
          status: 429,
          code: 'RESOURCE_RATE_LIMITED',
          retryAfterSeconds: 60,
        })
      )
    )
  })
})

describe('Resource origin read protection', () => {
  it('rejects a read the cache did not answer like a read refused before the cache', async () => {
    const events: string[] = []
    const keys: string[] = []
    const request = new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
      headers: { 'cf-connecting-ip': '203.0.113.7', 'x-request-id': 'origin_burst' },
    })

    const atOrigin = await protectResourceOriginRead({
      request,
      limiter: rejectedLimiter(keys),
      reportLimited: (category, requestId) => events.push(`limited:${category}:${requestId}`),
    })
    const beforeCache = await protectResourceRequest({
      request,
      authorize: async () => undefined,
      limiters: limitersFrom({ reading: rejectedLimiter([]) }),
    })

    assert.equal(atOrigin?.status, 429)
    assert.deepEqual([...(atOrigin?.headers ?? [])], [...(beforeCache?.headers ?? [])])
    assert.equal(atOrigin?.headers.get('retry-after'), '60')
    assert.equal(atOrigin?.headers.get('cache-control'), 'private, no-store')
    assert.equal(atOrigin?.headers.get('x-request-id'), 'origin_burst')
    assert.equal(await atOrigin?.text(), await beforeCache?.text())
    assert.deepEqual(events, ['limited:origin-reading:origin_burst'])
    assert.deepEqual(keys, ['address:203.0.113.7'])
  })

  it('counts only Online reads: search, Offline copies and operational routes have their own rules', async () => {
    const calls: string[] = []
    const limiter = acceptedLimiter(calls, 'origin-reading')

    for (const url of [
      'https://api.bible-strong.app/v1/bibles/LSG/search?q=grace',
      'https://api.bible-strong.app/v1/bibles/LSG/semantic-search?q=grace',
      'https://api.bible-strong.app/v1/naves/fr/random',
      'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip',
      'https://api.bible-strong.app/v1/offline-archives/bibles/bible-lsg.json.encrypted.zip',
      'https://api.bible-strong.app/v1/offline-catalog',
      'https://api.bible-strong.app/health',
    ]) {
      assert.equal(
        await protectResourceOriginRead({ request: new Request(url), limiter }),
        undefined
      )
    }
    assert.deepEqual(calls, [])

    assert.equal(
      await protectResourceOriginRead({
        request: new Request('https://api.bible-strong.app/v1/naves/fr/topics/aaron'),
        limiter,
      }),
      undefined
    )
    assert.deepEqual(calls, ['origin-reading'])
  })

  it('fails open with a sanitized report when the origin counter is unavailable', async () => {
    const failures: { category: string; message: string }[] = []
    const response = await protectResourceOriginRead({
      request: new Request('https://api.bible-strong.app/v1/dictionaries/bost/fr/entries/grace'),
      limiter: {
        async limit() {
          throw new Error('RATE_LIMIT_BINDING_UNAVAILABLE')
        },
      },
      reportFailure: (category, _requestId, cause) =>
        failures.push({
          category,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    })

    assert.equal(response, undefined)
    assert.deepEqual(failures, [
      { category: 'origin-reading', message: 'RATE_LIMIT_BINDING_UNAVAILABLE' },
    ])
  })
})
