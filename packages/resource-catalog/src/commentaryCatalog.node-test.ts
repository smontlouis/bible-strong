import assert from 'node:assert/strict'
import test from 'node:test'

import { BUNDLED_MOBILE_RESOURCE_CATALOG } from './catalog'
import { COMMENTARY_CATALOG } from './commentaryCatalog'

test('the commentary catalog exposes 32 works and 36 downloadable language projections', () => {
  assert.equal(COMMENTARY_CATALOG.length, 32)

  const projections = COMMENTARY_CATALOG.flatMap(entry =>
    entry.languages.map(language => `database:${entry.publicationId}:${language}`)
  )
  assert.equal(projections.length, 36)
  assert.equal(new Set(projections).size, 36)
  for (const projection of projections) {
    assert.ok(BUNDLED_MOBILE_RESOURCE_CATALOG.resources[projection], projection)
  }
})
