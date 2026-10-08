import {
  getInterlinearBiblePublication,
  getPublishedInterlinearTextIdentity,
} from '../interlinearBiblePublications'
import * as mobileResourceCatalog from '../mobileResourceCatalog'
import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  loadMobileResourceCatalog,
  type MobileResourceCatalog,
} from '../mobileResourceCatalog'

jest.mock('../firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

const bundled = BUNDLED_MOBILE_RESOURCE_CATALOG
const bundledText = {
  textRevision: bundled.resources['bible:BHG']!.textRevision!,
  textSha256: bundled.resources['bible:BHG']!.textSha256!,
}
const nextText = {
  textRevision: 'bhg-e15bd9f0f1a91140579c',
  textSha256: 'e15bd9f0f1a91140579c9eb9c8f4e173b8a4df361859758e0fe252ef55edc107',
}

const withoutTextDeclarations = (catalog: MobileResourceCatalog): MobileResourceCatalog => {
  const copy = structuredClone(catalog)
  for (const entry of Object.values(copy.resources)) {
    delete entry.textRevision
    delete entry.textSha256
  }
  return copy
}

/** The catalog once a rebuilt BHG and both rebuilt indexes are published. */
const publishNextBhg = (catalog: MobileResourceCatalog = bundled): MobileResourceCatalog => {
  const copy = structuredClone(catalog)
  copy.generatedAt = '2099-01-01T00:00:00.000Z'
  const republish = (id: string, archiveSha256: string, archiveBytes: number) => {
    const entry = copy.resources[id]!
    const url = new URL(entry.url)
    url.searchParams.set('sha256', archiveSha256)
    Object.assign(entry, { archiveSha256, archiveBytes, url: url.toString(), ...nextText })
  }
  republish('bible:BHG', 'a'.repeat(64), 1784741)
  republish('bible-interlinear:BHG:fr', 'b'.repeat(64), 22552991)
  republish('bible-interlinear:BHG:en', 'c'.repeat(64), 22961000)
  return copy
}

const serve = (catalog: MobileResourceCatalog) =>
  loadMobileResourceCatalog(
    jest.fn(async () => new Response(JSON.stringify(catalog), { status: 200 })) as typeof fetch
  )

describe('BHG interlinear publication', () => {
  it('reads the published Bible and indexes from the bundled catalog', () => {
    const publication = getInterlinearBiblePublication()

    expect(publication).toMatchObject({ applicationVersionId: 'BHG', datasetId: 'STEP' })
    expect(publication.text).toMatchObject({
      entry: bundled.resources['bible:BHG']!.entry,
      archiveSha256: bundled.resources['bible:BHG']!.archiveSha256,
      archiveBytes: bundled.resources['bible:BHG']!.archiveBytes,
      text: bundledText,
    })
    for (const language of ['fr', 'en'] as const) {
      const entry = bundled.resources[`bible-interlinear:BHG:${language}`]!
      expect(publication.indexes[language]).toMatchObject({
        entry: entry.entry,
        archiveSha256: entry.archiveSha256,
        archiveBytes: entry.archiveBytes,
        contentSha256: entry.contentSha256,
        // Both indexes are built for the text the catalog publishes.
        text: bundledText,
      })
    }
  })

  it('follows a live catalog that publishes another BHG, with no application change', async () => {
    await serve(publishNextBhg())

    const publication = getInterlinearBiblePublication()

    expect(publication.text).toMatchObject({
      archiveSha256: 'a'.repeat(64),
      archiveBytes: 1784741,
      text: nextText,
    })
    expect(publication.text.url).toContain(`sha256=${'a'.repeat(64)}`)
    expect(publication.indexes.fr).toMatchObject({ archiveSha256: 'b'.repeat(64), text: nextText })
    expect(publication.indexes.en).toMatchObject({ archiveSha256: 'c'.repeat(64), text: nextText })
  })

  it('completes a live catalog served before the declaration existed', async () => {
    await serve(withoutTextDeclarations(bundled))
    expect(
      mobileResourceCatalog.MOBILE_RESOURCE_CATALOG.resources['bible:BHG']!.textRevision
    ).toBeUndefined()

    const publication = getInterlinearBiblePublication()

    // Same archives as the bundled catalog: their text is the one it declares.
    expect(publication.text.text).toEqual(bundledText)
    expect(publication.indexes.fr.text).toEqual(bundledText)
  })

  it('knows no text for an archive no catalog it holds describes', async () => {
    await serve(withoutTextDeclarations(publishNextBhg()))

    const publication = getInterlinearBiblePublication()

    expect(publication.text.archiveSha256).toBe('a'.repeat(64))
    expect(publication.text.text).toBeUndefined()
    expect(publication.indexes.fr.text).toBeUndefined()
  })

  it('names the text of an installed archive from the catalogs it holds', async () => {
    await serve(publishNextBhg())

    expect(getPublishedInterlinearTextIdentity('a'.repeat(64))).toEqual(nextText)
    // The archive the bundled catalog lists stays known after a newer catalog replaced it.
    expect(
      getPublishedInterlinearTextIdentity(bundled.resources['bible:BHG']!.archiveSha256)
    ).toEqual(bundledText)
    expect(getPublishedInterlinearTextIdentity('f'.repeat(64))).toBeUndefined()
    expect(getPublishedInterlinearTextIdentity(undefined)).toBeUndefined()
  })
})
