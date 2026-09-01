import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  configureResourceArtifactBaseUrl,
  getMobileBibleVersionIds,
  getMobileResourceCatalogEntry,
  isMobileResourceCatalog,
  loadMobileResourceCatalog,
  MOBILE_RESOURCE_CATALOG,
  MOBILE_RESOURCE_CATALOG_URL,
  resolveMobileResourceArtifactUrl,
  resolveMobileResourceCatalog,
} from '../mobileResourceCatalog'
import { ONLINE_BIBLE_VERSION_IDS } from '../ordinaryBibleVersions'

describe('mobile resource catalog', () => {
  it('declares every ordinary Bible identity exactly once', () => {
    expect(getMobileBibleVersionIds()).toHaveLength(47)
    expect(new Set(getMobileBibleVersionIds()).size).toBe(47)
  })

  it('makes every ordinary Bible available through Online delivery', () => {
    expect(ONLINE_BIBLE_VERSION_IDS).toEqual(getMobileBibleVersionIds())
    expect(ONLINE_BIBLE_VERSION_IDS).toContain('PDV2017')
  })

  it('contains every downloadable resource as a ZIP', () => {
    expect(isMobileResourceCatalog(BUNDLED_MOBILE_RESOURCE_CATALOG)).toBe(true)
    expect(MOBILE_RESOURCE_CATALOG.resourceCount).toBe(114)
    expect(Object.values(MOBILE_RESOURCE_CATALOG.resources)).toHaveLength(114)
    expect(MOBILE_RESOURCE_CATALOG.resources['dictionary-directory']).toBeDefined()
    expect(
      Object.values(MOBILE_RESOURCE_CATALOG.resources).every(resource =>
        new URL(resource.url).pathname.endsWith('.zip')
      )
    ).toBe(true)
    for (const resource of Object.values(MOBILE_RESOURCE_CATALOG.resources)) {
      const sha256 = new URL(resource.url).searchParams.get('sha256')
      if (sha256) expect(sha256).toBe(resource.archiveSha256)
    }
  })

  it('uses the Resource API catalog with the bundled catalog as network fallback', async () => {
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

    const nbs = BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible:NBS']
    expect(
      isMobileResourceCatalog({
        ...BUNDLED_MOBILE_RESOURCE_CATALOG,
        resources: {
          ...BUNDLED_MOBILE_RESOURCE_CATALOG.resources,
          'bible:NBS': { ...nbs, url: `${nbs.url}?sha256=${'0'.repeat(64)}` },
        },
      })
    ).toBe(false)
  })

  it('reuses the bundled fallback after a transient failure for the rest of the session', async () => {
    const newerCatalog = {
      ...BUNDLED_MOBILE_RESOURCE_CATALOG,
      generatedAt: '2099-01-01T00:00:00.000Z',
    }
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(newerCatalog), { status: 200 }))

    await expect(loadMobileResourceCatalog(fetcher)).resolves.toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
    await expect(loadMobileResourceCatalog(fetcher)).resolves.toBe(BUNDLED_MOBILE_RESOURCE_CATALOG)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('bundles optional pericope and red-word JSON files with legacy Bibles', () => {
    const nbs = getMobileResourceCatalogEntry('bible:NBS')
    expect(new URL(nbs.url).pathname).toBe('/v1/offline-artifacts/bibles/bible-nbs.json.zip')
    expect(nbs).toEqual(
      expect.objectContaining({
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
    const ost = getMobileResourceCatalogEntry('bible:OST')
    expect(new URL(ost.url).pathname).toBe('/v1/offline-artifacts/bibles/bible-ost.json.zip')
    expect(ost).toEqual(
      expect.objectContaining({
        entry: 'bible-ost.json',
        strategy: 'sqlite-import',
      })
    )
    const nave = getMobileResourceCatalogEntry('database:NAVE:fr')
    expect(new URL(nave.url).pathname).toBe('/v1/offline-artifacts/databases/nave-fr.sqlite.zip')
    expect(nave).toEqual(
      expect.objectContaining({
        entry: 'nave-fr.sqlite',
        strategy: 'archive-extract',
      })
    )
  })

  it('can route immutable artifacts through a local development server', () => {
    const entry = BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible:LSG']
    const query = new URL(entry.url).search
    expect(resolveMobileResourceArtifactUrl(entry, 'http://10.0.2.2:8788')).toBe(
      `http://10.0.2.2:8788/bibles/bible-lsg.json.zip${query}`
    )
    expect(resolveMobileResourceArtifactUrl(entry, 'file:///tmp/resources')).toBe(entry.url)
    expect(resolveMobileResourceArtifactUrl(entry, 'not-a-url')).toBe(entry.url)
    expect(
      resolveMobileResourceArtifactUrl(
        { ...entry, url: `${entry.url}?sha256=${'a'.repeat(64)}` },
        'http://10.0.2.2:8788'
      )
    ).toBe(`http://10.0.2.2:8788/bibles/bible-lsg.json.zip?sha256=${'a'.repeat(64)}`)
  })

  it('keeps the catalog CDN when no local artifact server is explicitly configured', () => {
    const entry = BUNDLED_MOBILE_RESOURCE_CATALOG.resources['bible:LSG']
    const runtime = globalThis as typeof globalThis & { __DEV__?: boolean }
    const previousDevelopmentMode = runtime.__DEV__
    runtime.__DEV__ = true

    try {
      configureResourceArtifactBaseUrl('http://127.0.0.1:8788')
      expect(resolveMobileResourceArtifactUrl(entry)).toBe(
        `http://127.0.0.1:8788/bibles/bible-lsg.json.zip${new URL(entry.url).search}`
      )

      configureResourceArtifactBaseUrl(undefined)
      expect(resolveMobileResourceArtifactUrl(entry)).toBe(entry.url)
    } finally {
      configureResourceArtifactBaseUrl(undefined)
      if (previousDevelopmentMode === undefined) delete runtime.__DEV__
      else runtime.__DEV__ = previousDevelopmentMode
    }
  })

  it('fails closed for an undeclared resource', () => {
    expect(() => getMobileResourceCatalogEntry('database:UNKNOWN:fr')).toThrow(
      'MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:database:UNKNOWN:fr'
    )
  })
})
