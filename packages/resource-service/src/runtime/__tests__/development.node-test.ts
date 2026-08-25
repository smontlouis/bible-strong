import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getDevelopmentEndpoints,
  RESOURCE_DEVELOPMENT_COMMANDS,
  shouldImportResourcePublications,
} from '../development'

describe('Resource development bootstrap', () => {
  it('starts and migrates persistent PostgreSQL without a reset operation', () => {
    assert.deepEqual(RESOURCE_DEVELOPMENT_COMMANDS, [
      ['docker', 'compose', '-f', 'compose.yaml', 'up', '-d', '--wait'],
      ['yarn', 'migrate'],
    ])
    assert.equal(JSON.stringify(RESOURCE_DEVELOPMENT_COMMANDS).includes('down'), false)
    assert.equal(JSON.stringify(RESOURCE_DEVELOPMENT_COMMANDS).includes('volume'), false)
    assert.equal(JSON.stringify(RESOURCE_DEVELOPMENT_COMMANDS).includes('reset'), false)
  })

  it('reports addresses for the host, simulators, emulators, and physical devices', () => {
    assert.deepEqual(getDevelopmentEndpoints({ port: 8787, lanAddress: '192.168.1.42' }), {
      host: 'http://localhost:8787',
      iosSimulator: 'http://127.0.0.1:8787',
      androidEmulator: 'http://10.0.2.2:8787',
      physicalDevice: 'http://192.168.1.42:8787',
    })
  })

  it('can explicitly skip imports even when publication paths are inherited', () => {
    assert.equal(
      shouldImportResourcePublications({
        RESOURCE_SKIP_IMPORT: '1',
        RESOURCE_PUBLICATION_ROOTS: '/existing/catalog',
      }),
      false
    )
    assert.equal(
      shouldImportResourcePublications({ RESOURCE_PUBLICATION_ROOTS: '/existing/catalog' }),
      true
    )
  })
})
