import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BUNDLED_MOBILE_RESOURCE_CATALOG, type MobileResourceCatalog } from './catalog'
import {
  findInterlinearBibleCatalogMismatches,
  getCatalogTextIdentity,
  resolveCatalogTextIdentity,
  resolveInterlinearBiblePublication,
} from './interlinearBiblePublicationCatalog'

const withResources = (
  resources: Record<string, Partial<MobileResourceCatalog['resources'][string]>>,
  base: MobileResourceCatalog = BUNDLED_MOBILE_RESOURCE_CATALOG
): MobileResourceCatalog => ({
  ...base,
  resources: {
    ...base.resources,
    ...Object.fromEntries(
      Object.entries(resources).map(([id, patch]) => [id, { ...base.resources[id]!, ...patch }])
    ),
  },
})

const withoutTextDeclarations = (catalog: MobileResourceCatalog): MobileResourceCatalog => ({
  ...catalog,
  resources: Object.fromEntries(
    Object.entries(catalog.resources).map(([id, entry]) => {
      const { textRevision: _textRevision, textSha256: _textSha256, ...undeclared } = entry
      return [id, undeclared]
    })
  ),
})

const nextText = {
  textRevision: 'bhg-e15bd9f0f1a91140579c',
  textSha256: 'e15bd9f0f1a91140579c9eb9c8f4e173b8a4df361859758e0fe252ef55edc107',
}

describe('interlinear Bible publication catalog', () => {
  it('publishes the original-language Bible and both indexes for one text', () => {
    const publication = resolveInterlinearBiblePublication()

    assert.equal(publication.applicationVersionId, 'BHG')
    assert.equal(publication.datasetId, 'STEP')
    assert.ok(publication.text.text)
    assert.deepEqual(publication.indexes.fr.text, publication.text.text)
    assert.deepEqual(publication.indexes.en.text, publication.text.text)
    assert.equal(
      publication.text.text.textRevision,
      `bhg-${publication.text.text.textSha256.slice(0, 20)}`
    )
    assert.deepEqual(findInterlinearBibleCatalogMismatches(BUNDLED_MOBILE_RESOURCE_CATALOG), [])
  })

  it('follows the catalog it is given instead of the bundled one', () => {
    const published = withResources({
      'bible:BHG': { archiveSha256: 'a'.repeat(64), archiveBytes: 1784741, ...nextText },
      'bible-interlinear:BHG:fr': { archiveSha256: 'b'.repeat(64), ...nextText },
      'bible-interlinear:BHG:en': { archiveSha256: 'c'.repeat(64), ...nextText },
    })

    const publication = resolveInterlinearBiblePublication(published, [
      BUNDLED_MOBILE_RESOURCE_CATALOG,
    ])

    assert.equal(publication.text.archiveSha256, 'a'.repeat(64))
    assert.equal(publication.text.archiveBytes, 1784741)
    assert.deepEqual(publication.text.text, nextText)
    assert.equal(publication.indexes.fr.archiveSha256, 'b'.repeat(64))
    assert.deepEqual(publication.indexes.en.text, nextText)
  })

  it('completes a catalog that predates the declaration from one listing the same archives', () => {
    const served = withoutTextDeclarations(BUNDLED_MOBILE_RESOURCE_CATALOG)

    assert.equal(resolveInterlinearBiblePublication(served).text.text, undefined)
    assert.deepEqual(
      resolveInterlinearBiblePublication(served, [BUNDLED_MOBILE_RESOURCE_CATALOG]).text.text,
      getCatalogTextIdentity(BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible:BHG'])
    )
  })

  it('never lends a declaration to another archive', () => {
    const served = withResources(
      { 'bible:BHG': { archiveSha256: 'a'.repeat(64) } },
      withoutTextDeclarations(BUNDLED_MOBILE_RESOURCE_CATALOG)
    )

    assert.equal(
      resolveCatalogTextIdentity('bible:BHG', 'a'.repeat(64), [
        served,
        BUNDLED_MOBILE_RESOURCE_CATALOG,
      ]),
      undefined
    )
  })

  it('reports an index paired with another text than the catalog publishes', () => {
    const textOnly = withResources({
      'bible:BHG': { archiveSha256: 'a'.repeat(64), ...nextText },
    })

    assert.deepEqual(findInterlinearBibleCatalogMismatches(textOnly), [
      'bible-interlinear:BHG:en',
      'bible-interlinear:BHG:fr',
    ])
    assert.deepEqual(
      findInterlinearBibleCatalogMismatches(withoutTextDeclarations(textOnly)),
      [],
      'a catalog without declarations has nothing to contradict'
    )
  })

  it('rejects a catalog that lost one of the three entries', () => {
    const { 'bible-interlinear:BHG:en': _removed, ...resources } =
      BUNDLED_MOBILE_RESOURCE_CATALOG.resources

    assert.throws(
      () => resolveInterlinearBiblePublication({ ...BUNDLED_MOBILE_RESOURCE_CATALOG, resources }),
      /INTERLINEAR_BIBLE_CATALOG_ENTRY_MISSING:bible-interlinear:BHG:en/
    )
  })
})
