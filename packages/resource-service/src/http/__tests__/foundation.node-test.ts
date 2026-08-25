import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { OpenApi } from '@effect/platform'

import { ResourceApi } from '../api'
import { makeResourceWebHandler } from '../app'

describe('Resource service foundation', () => {
  it('serves the Effect HttpApi health contract through a Web-compatible handler', async () => {
    const web = makeResourceWebHandler()

    try {
      const response = await web.handler(new Request('http://localhost/health'))

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { status: 'ok' })
    } finally {
      await web.dispose()
    }
  })

  it('generates OpenAPI from the same Effect Schema contract', () => {
    const specification = OpenApi.fromApi(ResourceApi)

    assert.equal(specification.openapi, '3.1.0')
    assert.ok(specification.paths['/health']?.get)
    assert.ok(specification.paths['/v1/bibles/{version}/books/{book}/chapters/{chapter}']?.get)
    assert.ok(specification.paths['/v1/bibles/{version}/verses']?.get)
    assert.ok(
      specification.paths['/v1/bibles/{version}/books/{book}/chapters/{chapter}']?.get?.responses[
        '429'
      ]
    )
    assert.equal(specification.paths['/health']?.get?.responses['429'], undefined)
  })
})
