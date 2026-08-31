import assert from 'node:assert/strict'
import test from 'node:test'

import { BUNDLED_MOBILE_RESOURCE_CATALOG } from './catalog'
import { COMMENTARY_CATALOG } from './commentaryCatalog'

test('the commentary catalog exposes 31 works and 34 downloadable language projections', () => {
  assert.equal(COMMENTARY_CATALOG.length, 31)

  const projections = COMMENTARY_CATALOG.flatMap(entry =>
    entry.languages.map(language => `database:${entry.publicationId}:${language}`)
  )
  assert.equal(projections.length, 34)
  assert.equal(new Set(projections).size, 34)
  for (const projection of projections) {
    assert.ok(BUNDLED_MOBILE_RESOURCE_CATALOG.resources[projection], projection)
  }
})
