import {
  acceptsServedCatalogIn2711,
  isMobileResourceCatalogIn2711,
} from '../../../test/fixtures/mobileResourceCatalog-27.1.1'
import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  isMobileResourceCatalog,
  resolveMobileResourceCatalog,
  type MobileResourceCatalog,
} from '../mobileResourceCatalog'

jest.mock('../firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

/** A BHG text that is not published yet. */
const nextText = {
  textRevision: `bhg-${'f'.repeat(20)}`,
  textSha256: 'f'.repeat(64),
}

/**
 * The catalog once the rebuilt BHG and both rebuilt indexes are published, BHG as its canonical
 * JSON like the other Bibles.
 */
const publishNextBhg = (): MobileResourceCatalog => {
  const catalog = structuredClone(BUNDLED_MOBILE_RESOURCE_CATALOG)
  catalog.generatedAt = '2099-01-01T00:00:00.000Z'
  const republish = (
    id: string,
    archiveSha256: string,
    archiveBytes: number,
    archive?: { file: string; entry: string }
  ) => {
    const entry = catalog.resources[id]!
    const url = new URL(archive?.file ?? entry.file, new URL('/v1/offline-artifacts/', entry.url))
    url.searchParams.set('sha256', archiveSha256)
    Object.assign(entry, {
      archiveSha256,
      archiveBytes,
      url: url.toString(),
      ...nextText,
      ...(archive
        ? {
            ...archive,
            entries: { canonical: { ...entry.entries.canonical!, entry: archive.entry } },
          }
        : {}),
    })
  }
  republish('bible:BHG', 'a'.repeat(64), 1952000, {
    file: 'bibles/bible-bhg.json.zip',
    entry: 'bible-bhg.json',
  })
  republish('bible-interlinear:BHG:fr', 'b'.repeat(64), 22552991)
  republish('bible-interlinear:BHG:en', 'c'.repeat(64), 22961000)
  return catalog
}

describe('the catalog served to Bible Strong 27.1.1', () => {
  it('is still accepted with the text declarations of BHG and its indexes', () => {
    const served = BUNDLED_MOBILE_RESOURCE_CATALOG

    expect(served.resources['bible-interlinear:BHG:fr']!.textRevision).toBe(
      served.resources['bible:BHG']!.textRevision
    )
    expect(isMobileResourceCatalogIn2711(served)).toBe(true)
    expect(acceptsServedCatalogIn2711(served)).toBe(true)
  })

  it('is still accepted once another BHG is published', () => {
    const served = publishNextBhg()

    expect(isMobileResourceCatalogIn2711(served)).toBe(true)
    expect(acceptsServedCatalogIn2711(served)).toBe(true)
    expect(resolveMobileResourceCatalog(served)).toBe(served)
  })

  it('would be rejected, and replaced by its own bundled catalog, if an entry lost a field', () => {
    const served = publishNextBhg()
    delete (served.resources['bible:BHG'] as Partial<MobileResourceCatalog['resources'][string]>)
      .contentSha256

    expect(isMobileResourceCatalogIn2711(served)).toBe(false)
    expect(acceptsServedCatalogIn2711(served)).toBe(false)
  })
})

describe('text declarations in the catalog the application holds', () => {
  const withBhg = (patch: Record<string, unknown>) => {
    const catalog = structuredClone(BUNDLED_MOBILE_RESOURCE_CATALOG)
    Object.assign(catalog.resources['bible:BHG']!, patch)
    return catalog
  }

  it('accepts a catalog served before the declarations existed', () => {
    const catalog = withBhg({})
    for (const entry of Object.values(catalog.resources)) {
      delete entry.textRevision
      delete entry.textSha256
    }

    expect(isMobileResourceCatalog(catalog)).toBe(true)
    expect(resolveMobileResourceCatalog(catalog)).toBe(catalog)
  })

  it.each([
    ['a revision without its hash', { textSha256: undefined }],
    ['a hash without its revision', { textRevision: undefined }],
    ['an empty revision', { textRevision: '' }],
    ['a malformed hash', { textSha256: 'not-a-sha256' }],
  ])('rejects %s rather than guess a text', (_label, patch) => {
    expect(isMobileResourceCatalog(withBhg(patch))).toBe(false)
    expect(resolveMobileResourceCatalog(withBhg(patch))).toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
  })
})
