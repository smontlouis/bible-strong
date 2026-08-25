import assert from 'node:assert/strict'

const baseUrl = process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8787'

const getJson = async path => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: 'application/json' } })
  const body = await response.json().catch(() => undefined)
  return { response, body }
}

const french = await getJson('/v1/timelines/fr/events')
assert.equal(french.response.status, 200)
assert.equal(french.body.resource.language, 'fr')
assert.equal(french.body.events.length, 625)
assert.ok(french.body.events[0].slug)

const event = await getJson('/v1/timelines/fr/events/1-corinthians-written')
assert.equal(event.response.status, 200)
assert.equal(event.body.event.slug, '1-corinthians-written')
assert.equal(event.body.resource.revision, french.body.resource.revision)

const english = await getJson('/v1/timelines/en/events')
assert.equal(english.response.status, 200)
assert.equal(english.body.resource.language, 'en')
assert.equal(english.body.events.length, 625)

const cached = await fetch(`${baseUrl}/v1/timelines/fr/events`, {
  headers: { 'if-none-match': french.response.headers.get('etag') },
})
assert.equal(cached.status, 304)

const missing = await getJson('/v1/timelines/fr/events/not-a-real-event')
assert.equal(missing.response.status, 404)

console.log(
  JSON.stringify({
    frenchRevision: french.body.resource.revision,
    englishRevision: english.body.resource.revision,
    events: french.body.events.length,
    cached: cached.status,
    missing: missing.response.status,
  })
)
