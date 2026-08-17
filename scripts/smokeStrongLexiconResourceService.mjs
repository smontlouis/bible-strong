import assert from 'node:assert/strict'

const apiBaseUrl = process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8891'
const artifactBaseUrl = process.env.RESOURCE_ARTIFACT_BASE_URL ?? 'http://127.0.0.1:8890'

const requestJson = async (url, expectedStatus = 200, headers = {}) => {
  const response = await fetch(url, { headers })
  assert.equal(response.status, expectedStatus, `${url}: ${response.status}`)
  return { response, body: expectedStatus === 200 ? await response.json() : undefined }
}

await requestJson(`${apiBaseUrl}/health`)

for (const moduleId of ['core', 'resources', 'entities']) {
  const { body } = await requestJson(`${apiBaseUrl}/v1/strong-lexicon/modules/${moduleId}`)
  assert.equal(body.moduleId, moduleId)
  assert.equal(body.status, 'available')
}

const entry = await requestJson(
  `${apiBaseUrl}/v1/strong-lexicon/entries/G0001G?language=en&kind=estrong`
)
assert.deepEqual(entry.body.selectedIdentity, { kind: 'estrong', code: 'G0001G' })
const etag = entry.response.headers.get('etag')
assert.ok(etag)
const cached = await fetch(
  `${apiBaseUrl}/v1/strong-lexicon/entries/G0001G?language=en&kind=estrong`,
  { headers: { 'if-none-match': etag } }
)
assert.equal(cached.status, 304)

const search = (
  await requestJson(`${apiBaseUrl}/v1/strong-lexicon/entries?language=en&search=alpha&limit=10`)
).body
assert.ok(search.entries.length > 0)
const morphologies = (
  await requestJson(`${apiBaseUrl}/v1/strong-lexicon/morphologies?language=en&codes=G:N-LI`)
).body
assert.ok(morphologies.morphologies.length > 0)
const entity = (
  await requestJson(
    `${apiBaseUrl}/v1/strong-lexicon/entities/${encodeURIComponent('Aaron@Exo.4.14-Heb')}?language=fr`
  )
).body
assert.ok(entity.entity.relations.length > 0)
const chapter = (
  await requestJson(
    `${apiBaseUrl}/v1/strong-lexicon/entities/chapters/1Ch/6?language=fr&strongCodes=H0175`
  )
).body
assert.ok(chapter.entities.length > 0)
await requestJson(`${apiBaseUrl}/v1/strong-lexicon/entities/does-not-exist?language=fr`, 404)

const artifact = await fetch(`${artifactBaseUrl}/databases/strong_lexicon.core.sqlite.zip`)
assert.equal(artifact.status, 200)
assert.equal(Number(artifact.headers.get('content-length')), 6_543_526)
await requestJson(`${artifactBaseUrl}/databases/does-not-exist.zip`, 404)

console.log('strong lexicon resource-service smoke ok', {
  entry: entry.body.selectedIdentity,
  search: search.entries.length,
  morphologies: morphologies.morphologies.length,
  relations: entity.entity.relations.length,
  chapterEntities: chapter.entities.length,
})
