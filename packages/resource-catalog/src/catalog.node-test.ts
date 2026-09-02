import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  getCatalogBibleVersionIds,
  getCatalogStrongBibleVersionIds,
} from './catalog'
import { ONLINE_BIBLE_VERSION_IDS } from './ordinaryBibleVersions'

describe('resource catalog', () => {
  it('keeps the English default Bible available online', () => {
    assert.equal(ONLINE_BIBLE_VERSION_IDS.includes('KJV'), true)
  })
  it('keeps the generated count and identities coherent', () => {
    assert.equal(
      BUNDLED_MOBILE_RESOURCE_CATALOG.resourceCount,
      Object.keys(BUNDLED_MOBILE_RESOURCE_CATALOG.resources).length
    )
    assert.ok(getCatalogBibleVersionIds().includes('LSG'))
    assert.ok(getCatalogStrongBibleVersionIds().includes('LSG'))
  })
})
