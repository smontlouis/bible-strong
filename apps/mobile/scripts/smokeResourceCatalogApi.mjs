import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const baseUrl = (process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/u, '')
const catalog = JSON.parse(
  await readFile(
    new URL('../../../packages/resource-catalog/src/mobile-resource-catalog.json', import.meta.url),
    'utf8'
  )
)

const endpointFor = id => {
  const [family, value, language] = id.split(':')

  if (family === 'bible') return `/v1/bibles/${encodeURIComponent(value)}/coverage`
  if (family === 'bible-strong') {
    return `/v1/strong-bibles/${encodeURIComponent(value)}/coverage`
  }
  if (family === 'bible-interlinear') {
    return `/v1/interlinear-bibles/${value}/languages/${language}/coverage`
  }
  if (family === 'strong-lexicon') return `/v1/strong-lexicon/modules/${value}`

  if (family === 'database') {
    if (value === 'DICTIONNAIRE') return `/v1/dictionaries/${language}/entries?limit=1`
    if (value === 'NAVE') return `/v1/naves/${language}/topics?initial=A`
    if (value === 'TIMELINE') return `/v1/timelines/${language}/events`
    if (value === 'MHY') return '/v1/commentaries/MHY/fr/verses/1-1-1'
    if (value === 'TRESOR') return '/v1/cross-references/fr/verses/1-1-1'
  }

  throw new Error(`RESOURCE_CATALOG_ENDPOINT_MISSING:${id}`)
}

const entries = Object.keys(catalog.resources).map(id => ({ id, path: endpointFor(id) }))
const results = await Promise.all(
  entries.map(async entry => {
    const response = await fetch(`${baseUrl}${entry.path}`, {
      headers: { accept: 'application/json' },
    })
    await response.arrayBuffer()
    return { ...entry, status: response.status }
  })
)
const failures = results.filter(result => result.status !== 200)

assert.equal(failures.length, 0, JSON.stringify(failures))
console.log(
  JSON.stringify({
    catalogCount: entries.length,
    requested: results.length,
    ok: results.length - failures.length,
    failures,
  })
)
