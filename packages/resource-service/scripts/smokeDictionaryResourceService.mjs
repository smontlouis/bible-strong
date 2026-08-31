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

  const catalog = await request('/v1/dictionaries')
  assert(catalog.response.status === 200, `catalog-status:${catalog.response.status}`)
  const frenchWork = catalog.body?.dictionaries?.find(
    dictionary => dictionary.resource?.language === 'fr'
  )
  const englishWork = catalog.body?.dictionaries?.find(
    dictionary => dictionary.resource?.language === 'en'
  )
  assert(frenchWork?.resource?.work, 'catalog-french-work-missing')
  assert(englishWork?.resource?.work, 'catalog-english-work-missing')

  const frBase = `/v1/dictionaries/${encodeURIComponent(frenchWork.resource.work)}/fr`
  const enBase = `/v1/dictionaries/${encodeURIComponent(englishWork.resource.work)}/en`
  const frList = await request(`${frBase}/entries?initial=a&limit=3`)
  assert(frList.response.status === 200, `fr-list-status:${frList.response.status}`)
  assert(frList.body?.resource?.language === 'fr', 'fr-list-resource-invalid')
  assert(Array.isArray(frList.body?.entries) && frList.body.entries.length > 0, 'fr-list-empty')
  const first = frList.body.entries[0]
  assert(Number.isSafeInteger(first.id) && typeof first.word === 'string', 'fr-list-entry-invalid')

  const wordPath = `${frBase}/entries/${encodeURIComponent(first.word)}`
  const byWord = await request(wordPath)
  assert(byWord.response.status === 200, `fr-detail-status:${byWord.response.status}`)
  assert(byWord.body?.entry?.id === first.id, 'fr-detail-id-mismatch')
  assert(typeof byWord.body?.entry?.definition === 'string', 'fr-detail-definition-missing')

  const byId = await request(`${frBase}/entries/by-id/${first.id}`)
  assert(byId.response.status === 200 && byId.body?.entry?.id === first.id, 'fr-id-detail-invalid')

  const cached = await request(wordPath, {
    headers: { 'if-none-match': byWord.response.headers.get('etag') ?? '' },
  })
  assert(cached.response.status === 304, `etag-status:${cached.response.status}`)

  const enList = await request(`${enBase}/entries?initial=a&limit=3`)
  assert(enList.response.status === 200, `en-list-status:${enList.response.status}`)
  assert(enList.body?.resource?.language === 'en', 'en-list-resource-invalid')
  assert(Array.isArray(enList.body?.entries) && enList.body.entries.length > 0, 'en-list-empty')

  const directory = await request('/v1/dictionaries/directory?language=fr&initial=a&limit=3')
  assert(directory.response.status === 200, `directory-status:${directory.response.status}`)
  assert(Array.isArray(directory.body?.items) && directory.body.items.length > 0, 'directory-empty')
  assert(Array.isArray(directory.body.items[0]?.sources), 'directory-sources-invalid')

  const verse = await request('/v1/dictionaries/verses/1-1-1/entries?language=fr')
  assert(verse.response.status === 200, `verse-status:${verse.response.status}`)
  assert(Array.isArray(verse.body?.entries), 'verse-entries-invalid')

  const missing = await request(`${frBase}/entries/__smoke_missing__`)
  assert(
    missing.response.status === 404 && missing.body?.code === 'DICTIONARY_ENTRY_NOT_FOUND',
    'missing-not-404'
  )

  const invalidLanguage = await request(
    `/v1/dictionaries/${encodeURIComponent(frenchWork.resource.work)}/de/entries`
  )
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
        directoryItemsChecked: directory.body.items.length,
        passageEntriesChecked: verse.body.entries.length,
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
