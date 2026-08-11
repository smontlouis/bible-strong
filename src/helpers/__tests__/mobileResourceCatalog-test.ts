import { getMobileResourceCatalogEntry, MOBILE_RESOURCE_CATALOG } from '../mobileResourceCatalog'

describe('mobile resource catalog', () => {
  it('contains every downloadable resource as a ZIP', () => {
    expect(MOBILE_RESOURCE_CATALOG.resourceCount).toBe(72)
    expect(Object.values(MOBILE_RESOURCE_CATALOG.resources)).toHaveLength(72)
    expect(
      Object.values(MOBILE_RESOURCE_CATALOG.resources).every(resource =>
        resource.url.endsWith('.zip')
      )
    ).toBe(true)
  })

  it('bundles optional pericope and red-word JSON files with legacy Bibles', () => {
    expect(getMobileResourceCatalogEntry('bible:NBS')).toEqual(
      expect.objectContaining({
        url: 'https://assets.bible-strong.app/bibles/bible-nbs.json.zip',
        entry: 'bible-nbs.json',
        entries: expect.objectContaining({
          canonical: expect.objectContaining({ entry: 'bible-nbs.json' }),
          pericope: expect.objectContaining({ entry: 'bible-nbs-pericope.json' }),
          redWords: expect.objectContaining({ entry: 'red-words-nbs.json' }),
        }),
      })
    )
    expect(() => getMobileResourceCatalogEntry('bible-pericope:NBS')).toThrow(
      'MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:bible-pericope:NBS'
    )
  })

  it('describes historical Bible and database archive entries', () => {
    expect(getMobileResourceCatalogEntry('bible:OST')).toEqual(
      expect.objectContaining({
        url: 'https://assets.bible-strong.app/bibles/bible-ost.json.zip',
        entry: 'bible-ost.json',
        strategy: 'sqlite-import',
      })
    )
    expect(getMobileResourceCatalogEntry('database:NAVE:fr')).toEqual(
      expect.objectContaining({
        url: 'https://assets.bible-strong.app/databases/nave-fr.sqlite.zip',
        entry: 'nave-fr.sqlite',
        strategy: 'archive-extract',
      })
    )
  })

  it('fails closed for an undeclared resource', () => {
    expect(() => getMobileResourceCatalogEntry('database:UNKNOWN:fr')).toThrow(
      'MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:database:UNKNOWN:fr'
    )
  })
})
