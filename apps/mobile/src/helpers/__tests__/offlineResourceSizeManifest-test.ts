import {
  bundledOfflineResourceSizeManifest,
  getOfflineResourceSizeEntry,
  toOfflineResourceSizeManifest,
} from '../offlineResourceSizeManifest'
import { BUNDLED_MOBILE_RESOURCE_CATALOG } from '../mobileResourceCatalog'

describe('offlineResourceSizeManifest', () => {
  it('ships a valid bundled fallback', () => {
    expect(bundledOfflineResourceSizeManifest).toEqual(
      toOfflineResourceSizeManifest(BUNDLED_MOBILE_RESOURCE_CATALOG)
    )
    expect(Object.keys(bundledOfflineResourceSizeManifest.resources)).toHaveLength(105)
  })

  it('uses decompressed installed bytes from the manifest', () => {
    const entry = getOfflineResourceSizeEntry('strong-lexicon:core', 1)

    expect(entry.installedBytes).toBeGreaterThan(entry.downloadBytes)
    expect(entry.confidence).toBe('exact')
  })

  it('keeps a conservative fallback for an unknown resource', () => {
    expect(getOfflineResourceSizeEntry('unknown', 1_000)).toMatchObject({
      downloadBytes: 1_000,
      installedBytes: 1_000,
      peakInstallationBytes: 1_150,
      confidence: 'estimated',
    })
  })
})
