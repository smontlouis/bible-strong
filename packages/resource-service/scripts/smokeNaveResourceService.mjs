import assert from 'node:assert/strict'

const baseUrl = process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8787'

const request = async path => {
  const response = await fetch(`${baseUrl}${path}`)
  const body = await response.json().catch(() => undefined)
  return { response, body }
}

const health = await request('/health')
assert.equal(health.response.status, 200)

const frenchTopic = await request('/v1/naves/fr/topics/love')
assert.equal(frenchTopic.response.status, 200)
assert.equal(frenchTopic.body.resource.language, 'fr')
assert.equal(frenchTopic.body.topic.normalizedName, 'love')

const frenchCached = await fetch(`${baseUrl}/v1/naves/fr/topics/love`, {
  headers: { 'if-none-match': frenchTopic.response.headers.get('etag') },
})
assert.equal(frenchCached.status, 304)

const englishTopic = await request('/v1/naves/en/topics/hamutal')
assert.equal(englishTopic.response.status, 200)
assert.equal(englishTopic.body.resource.language, 'en')

const frenchVerse = await request('/v1/naves/fr/verses/43-3-16/topics')
assert.equal(frenchVerse.response.status, 200)
assert.equal(frenchVerse.body.verseKey, '43-3-16')
assert.ok(frenchVerse.body.verseTopics.length > 0)

const englishRandom = await request('/v1/naves/en/random')
assert.equal(englishRandom.response.status, 200)
assert.equal(englishRandom.body.resource.language, 'en')

const missing = await request('/v1/naves/en/topics/not-a-real-topic')
assert.equal(missing.response.status, 404)

const unsupported = await request('/v1/naves/de/topics')
assert.equal(unsupported.response.status, 400)

console.log('nave-resource-service-smoke:ok')
