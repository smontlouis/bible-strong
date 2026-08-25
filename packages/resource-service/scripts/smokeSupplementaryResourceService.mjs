const baseUrl = process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8787'

const getJson = async path => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: 'application/json' } })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) throw new Error(`supplementary-smoke-http:${path}:${response.status}`)
  return { body, headers: response.headers }
}

const commentary = await getJson('/v1/commentaries/MHY/fr/verses/1-1-1')
if (commentary.body.resource.resourceId !== 'MHY' || commentary.body.content.length === 0) {
  throw new Error('supplementary-smoke-commentary-invalid')
}
const chapter = await getJson('/v1/commentaries/MHY/fr/chapters/1/1')
const chapterComments = JSON.parse(chapter.body.serializedComments)
if (chapter.body.book !== 1 || chapterComments['1'] !== commentary.body.content) {
  throw new Error('supplementary-smoke-chapter-invalid')
}
const references = await getJson('/v1/cross-references/fr/verses/1-1-1')
if (
  references.body.resource.resourceId !== 'TRESOR' ||
  !Array.isArray(references.body.references) ||
  references.body.references.length === 0
) {
  throw new Error('supplementary-smoke-cross-references-invalid')
}
const cached = await fetch(`${baseUrl}/v1/commentaries/MHY/fr/verses/1-1-1`, {
  headers: { accept: 'application/json', 'if-none-match': commentary.headers.get('etag') },
})
if (cached.status !== 304) throw new Error(`supplementary-smoke-etag:${cached.status}`)

console.log(
  JSON.stringify({
    commentaryRevision: commentary.body.resource.revision,
    commentaryBytes: commentary.body.content.length,
    crossReferenceCount: references.body.references.length,
    etag: cached.status,
  })
)
