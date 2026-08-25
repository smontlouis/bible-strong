import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  getCatalogBibleVersionIds,
  getCatalogStrongBibleVersionIds,
} from './catalog'

describe('resource catalog', () => {
  it('keeps the generated count and identities coherent', () => {
    assert.equal(
      BUNDLED_MOBILE_RESOURCE_CATALOG.resourceCount,
      Object.keys(BUNDLED_MOBILE_RESOURCE_CATALOG.resources).length
    )
    assert.ok(getCatalogBibleVersionIds().includes('LSG'))
    assert.ok(getCatalogStrongBibleVersionIds().includes('LSG'))
  })
})
