import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  getMobileResourceCatalogEntry,
  isMobileResourceCatalog,
  loadMobileResourceCatalog,
  MOBILE_RESOURCE_CATALOG,
  MOBILE_RESOURCE_CATALOG_URL,
  resolveMobileResourceCatalog,
} from '../mobileResourceCatalog'

describe('mobile resource catalog', () => {
  it('contains every downloadable resource as a ZIP', () => {
    expect(isMobileResourceCatalog(BUNDLED_MOBILE_RESOURCE_CATALOG)).toBe(true)
    expect(MOBILE_RESOURCE_CATALOG.resourceCount).toBe(72)
    expect(Object.values(MOBILE_RESOURCE_CATALOG.resources)).toHaveLength(72)
    expect(
      Object.values(MOBILE_RESOURCE_CATALOG.resources).every(resource =>
        resource.url.endsWith('.zip')
      )
    ).toBe(true)
  })

  it('uses the single CDN catalog with the bundled catalog as network fallback', async () => {
    const fetcher = jest.fn(async () => new Response(null, { status: 503 }))

    await expect(loadMobileResourceCatalog(fetcher)).resolves.toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
    expect(fetcher).toHaveBeenCalledWith(MOBILE_RESOURCE_CATALOG_URL, {
      headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal),
    })
  })

  it('accepts a complete catalog with additional resources for older app versions', () => {
    const newerCatalog = {
      ...BUNDLED_MOBILE_RESOURCE_CATALOG,
      generatedAt: '2099-01-01T00:00:00.000Z',
      resourceCount: BUNDLED_MOBILE_RESOURCE_CATALOG.resourceCount + 1,
      resources: {
        ...BUNDLED_MOBILE_RESOURCE_CATALOG.resources,
        'bible:FUTURE': {
          ...BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible:NBS'],
          id: 'bible:FUTURE',
        },
      },
    }
    expect(resolveMobileResourceCatalog(newerCatalog)).toBe(newerCatalog)
    expect(
      resolveMobileResourceCatalog({
        ...newerCatalog,
        resources: {},
        resourceCount: 0,
      })
    ).toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
    expect(
      resolveMobileResourceCatalog({
        ...BUNDLED_MOBILE_RESOURCE_CATALOG,
        generatedAt: '2000-01-01T00:00:00.000Z',
      })
    ).toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
  })

  it('rejects malformed archive metadata at the network boundary', () => {
    const malformedCatalog = {
      ...BUNDLED_MOBILE_RESOURCE_CATALOG,
      generatedAt: '2099-01-01T00:00:00.000Z',
      resources: {
        ...BUNDLED_MOBILE_RESOURCE_CATALOG.resources,
        'bible:NBS': {
          ...BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible:NBS'],
          archiveSha256: undefined,
          entries: {
            canonical: {
              entry: '../bible-nbs.json',
              bytes: 0,
              sha256: 'not-a-sha256',
            },
          },
        },
      },
    }

    expect(isMobileResourceCatalog(malformedCatalog)).toBe(false)
    expect(resolveMobileResourceCatalog(malformedCatalog)).toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
  })

  it('retries the CDN after a transient failure', async () => {
    const newerCatalog = {
      ...BUNDLED_MOBILE_RESOURCE_CATALOG,
      generatedAt: '2099-01-01T00:00:00.000Z',
    }
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(newerCatalog), { status: 200 }))

    await expect(loadMobileResourceCatalog(fetcher)).resolves.toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
    await expect(loadMobileResourceCatalog(fetcher)).resolves.toEqual(newerCatalog)
    expect(fetcher).toHaveBeenCalledTimes(2)
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
