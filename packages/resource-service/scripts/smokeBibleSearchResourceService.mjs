import assert from 'node:assert/strict'

const baseUrl = process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8787'

const request = async path => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: 'application/json' } })
  const body = await response.json().catch(() => undefined)
  return { response, body }
}

const search = await request('/v1/bibles/LSG/search?q=Dieu&limit=3&sortOrder=book')
assert.equal(search.response.status, 200)
assert.equal(search.body.resource.versionId, 'LSG')
assert.equal(search.body.results.length, 3)
assert.ok(search.body.count > search.body.results.length)
assert.match(search.body.results[0].highlighted, /\{\{Dieu\}\}/u)
assert.deepEqual(
  search.body.results.map(result => [result.book, result.chapter, result.verse]),
  [
    [1, 1, 1],
    [1, 1, 2],
    [1, 1, 3],
  ]
)

const nt = await request('/v1/bibles/LSG/search?q=Dieu&section=nt&limit=2')
assert.equal(nt.response.status, 200)
assert.ok(nt.body.results.every(result => result.book >= 40))

const cached = await fetch(`${baseUrl}/v1/bibles/LSG/search?q=Dieu&limit=3&sortOrder=book`, {
  headers: { 'if-none-match': search.response.headers.get('etag') },
})
assert.equal(cached.status, 304)

console.log(
  JSON.stringify({
    revision: search.body.resource.revision,
    resultCount: search.body.count,
    ntCount: nt.body.count,
    cached: cached.status,
  })
)
