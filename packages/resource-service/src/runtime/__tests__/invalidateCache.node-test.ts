import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import mobileResourceCatalog from '@bible-strong/resource-catalog/catalog'
import resourceApiInvalidations from '../resourceApiInvalidations.json'
import {
  readArguments,
  refreshArguments,
  unknownIdentities,
  withInvalidations,
} from '../../../scripts/invalidate-cache.mjs'

describe('yarn cache:invalidate', () => {
  it('reads API identities, site folders and a dry run together', () => {
    assert.deepEqual(
      readArguments(['--api', 'bible:LSG', 'database:MHY:fr', '--site', '/bible/lsg', '--dry-run']),
      {
        api: ['bible:LSG', 'database:MHY:fr'],
        site: ['/bible/lsg'],
        siteEverything: false,
        dryRun: true,
      }
    )
    assert.deepEqual(readArguments(['--site-everything']), {
      api: [],
      site: [],
      siteEverything: true,
      dryRun: false,
    })
  })

  it('refuses a call that names nothing, a value without its option, or both site forms', () => {
    assert.equal(readArguments([]), undefined)
    assert.equal(readArguments(['--dry-run']), undefined)
    assert.equal(readArguments(['bible:LSG']), undefined)
    assert.equal(readArguments(['--site-everything', '--site', '/bible']), undefined)
    assert.equal(readArguments(['--everything']), undefined)
  })

  it('accepts the identities of the catalog and of the cross-references only', () => {
    assert.deepEqual(
      unknownIdentities(
        ['bible:LSG', 'cross-references:fr', 'bible:NOPE', 'cross-references:de'],
        mobileResourceCatalog
      ),
      ['bible:NOPE', 'cross-references:de']
    )
  })

  it('counts one more invalidation for each identity, sorted', () => {
    assert.deepEqual(
      withInvalidations({ 'database:MHY:fr': 2 }, ['bible:LSG', 'database:MHY:fr', 'bible:LSG']),
      { 'bible:LSG': 1, 'database:MHY:fr': 3 }
    )
  })

  it('passes the folders, or every page, to the page refresh', () => {
    assert.deepEqual(refreshArguments(readArguments(['--site', '/bible/lsg', '/strong'])!), [
      '/bible/lsg',
      '/strong',
    ])
    assert.deepEqual(refreshArguments(readArguments(['--site-everything'])!), ['--everything'])
  })

  it('names only identities the catalog or the cross-references know', () => {
    assert.deepEqual(
      unknownIdentities(Object.keys(resourceApiInvalidations), mobileResourceCatalog),
      []
    )
  })
})
