const baseUrl = (process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/u, '')

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    throw new Error(`invalid-json:${path}:${text.slice(0, 120)}`)
  }
  return { response, body }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const main = async () => {
  const health = await request('/health')
  assert(health.response.status === 200 && health.body?.status === 'ok', 'health-failed')

  const frList = await request('/v1/dictionaries/fr/entries?initial=a&limit=3')
  assert(frList.response.status === 200, `fr-list-status:${frList.response.status}`)
  assert(frList.body?.resource?.language === 'fr', 'fr-list-resource-invalid')
  assert(Array.isArray(frList.body?.entries) && frList.body.entries.length > 0, 'fr-list-empty')
  const first = frList.body.entries[0]
  assert(Number.isSafeInteger(first.id) && typeof first.word === 'string', 'fr-list-entry-invalid')

  const wordPath = `/v1/dictionaries/fr/entries/${encodeURIComponent(first.word)}`
  const byWord = await request(wordPath)
  assert(byWord.response.status === 200, `fr-detail-status:${byWord.response.status}`)
  assert(byWord.body?.entry?.id === first.id, 'fr-detail-id-mismatch')
  assert(typeof byWord.body?.entry?.definition === 'string', 'fr-detail-definition-missing')

  const byId = await request(`/v1/dictionaries/fr/entries/by-id/${first.id}`)
  assert(byId.response.status === 200 && byId.body?.entry?.id === first.id, 'fr-id-detail-invalid')

  const cached = await request(wordPath, {
    headers: { 'if-none-match': byWord.response.headers.get('etag') ?? '' },
  })
  assert(cached.response.status === 304, `etag-status:${cached.response.status}`)

  const enList = await request('/v1/dictionaries/en/entries?initial=a&limit=3')
  assert(enList.response.status === 200, `en-list-status:${enList.response.status}`)
  assert(enList.body?.resource?.language === 'en', 'en-list-resource-invalid')
  assert(Array.isArray(enList.body?.entries) && enList.body.entries.length > 0, 'en-list-empty')

  const verse = await request('/v1/dictionaries/fr/verses/1-1-1/words')
  assert(verse.response.status === 200, `verse-status:${verse.response.status}`)
  assert(Array.isArray(verse.body?.words) && verse.body.words.length > 0, 'verse-empty')

  const missing = await request('/v1/dictionaries/fr/entries/__smoke_missing__')
  assert(
    missing.response.status === 404 && missing.body?.code === 'DICTIONARY_ENTRY_NOT_FOUND',
    'missing-not-404'
  )

  const invalidLanguage = await request('/v1/dictionaries/de/entries')
  assert(
    invalidLanguage.response.status === 400,
    `invalid-language-status:${invalidLanguage.response.status}`
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        frRevision: frList.body.resource.revision,
        enRevision: enList.body.resource.revision,
        frEntriesChecked: frList.body.entries.length,
        verseWordsChecked: verse.body.words.length,
      },
      null,
      2
    )
  )
}

main().catch(error => {
  console.error(
    `dictionary-resource-smoke-failed: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exitCode = 1
})
