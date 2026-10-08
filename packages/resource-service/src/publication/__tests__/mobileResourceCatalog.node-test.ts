import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { readMobileResourceCatalog } from '../mobileResourceCatalog'

const bundledCatalogPath = fileURLToPath(
  new URL('../../../../resource-catalog/src/mobile-resource-catalog.json', import.meta.url)
)

const nextText = {
  textRevision: 'bhg-e15bd9f0f1a91140579c',
  textSha256: 'e15bd9f0f1a91140579c9eb9c8f4e173b8a4df361859758e0fe252ef55edc107',
}

type Resources = Record<string, Record<string, unknown>>

const readPatchedCatalog = async (patch: (resources: Resources) => void) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mobile-catalog-'))
  try {
    const catalog = JSON.parse(await readFile(bundledCatalogPath, 'utf8')) as {
      resources: Resources
    }
    patch(catalog.resources)
    const catalogPath = path.join(directory, 'catalog.json')
    await writeFile(catalogPath, JSON.stringify(catalog))
    return await readMobileResourceCatalog(catalogPath)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('mobile resource catalog text declarations', () => {
  it('reads the text the bundled catalog declares for BHG and both indexes', async () => {
    const { resources } = await readMobileResourceCatalog(bundledCatalogPath)
    const text = resources.get('bible:BHG')!

    assert.match(text.textRevision!, /^bhg-[a-f0-9]{20}$/)
    assert.equal(text.textRevision, `bhg-${text.textSha256!.slice(0, 20)}`)
    for (const language of ['fr', 'en']) {
      const index = resources.get(`bible-interlinear:BHG:${language}`)!
      assert.equal(index.textRevision, text.textRevision)
      assert.equal(index.textSha256, text.textSha256)
    }
    // Self-describing Bibles declare nothing.
    assert.equal(resources.get('bible:LSG')!.textRevision, undefined)
  })

  it('refuses to publish a text without the indexes rebuilt for it', async () => {
    await assert.rejects(
      readPatchedCatalog(resources => Object.assign(resources['bible:BHG']!, nextText)),
      /MOBILE_RESOURCE_CATALOG_INTERLINEAR_TEXT_MISMATCH:bible-interlinear:BHG:en,bible-interlinear:BHG:fr/
    )
  })

  it('refuses to publish one index ahead of the other', async () => {
    await assert.rejects(
      readPatchedCatalog(resources => {
        Object.assign(resources['bible:BHG']!, nextText)
        Object.assign(resources['bible-interlinear:BHG:fr']!, nextText)
      }),
      /MOBILE_RESOURCE_CATALOG_INTERLINEAR_TEXT_MISMATCH:bible-interlinear:BHG:en$/
    )
  })

  it('accepts a text and both indexes moved to one revision', async () => {
    const { resources } = await readPatchedCatalog(resources => {
      for (const id of ['bible:BHG', 'bible-interlinear:BHG:fr', 'bible-interlinear:BHG:en']) {
        Object.assign(resources[id]!, nextText)
      }
    })

    assert.equal(resources.get('bible-interlinear:BHG:en')!.textRevision, nextText.textRevision)
  })

  it('refuses a partial text declaration', async () => {
    await assert.rejects(
      readPatchedCatalog(resources => {
        delete resources['bible:BHG']!.textSha256
      }),
      /MOBILE_RESOURCE_CATALOG_TEXT_IDENTITY_INVALID:bible:BHG/
    )
  })
})
