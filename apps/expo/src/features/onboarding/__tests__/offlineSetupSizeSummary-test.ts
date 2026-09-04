import type { DownloadItem } from '~helpers/offlineCopy'
import type {
  OfflineResourceSizeEntry,
  OfflineResourceSizeManifest,
} from '~helpers/offlineResourceSizeManifest'
import { getOfflineSetupSizeSummary } from '../offlineSetupSizeSummary'

const makeItem = (id: string, estimatedSize = 1): DownloadItem =>
  ({ id, estimatedSize }) as DownloadItem

const makeSize = (
  id: string,
  downloadBytes: number,
  installedBytes: number
): OfflineResourceSizeEntry => ({
  id,
  url: `https://example.com/${id}`,
  downloadBytes,
  contentBytes: installedBytes,
  installedBytes,
  peakInstallationBytes: installedBytes,
  strategy: 'archive-extract',
  confidence: 'exact',
})

describe('offline setup size summary', () => {
  it('shows transfer and installed sizes for every selected resource', () => {
    const manifest: OfflineResourceSizeManifest = {
      schemaVersion: 1,
      generatedAt: '2026-08-11T00:00:00.000Z',
      resources: {
        bible: makeSize('bible', 2, 15),
        lexicon: makeSize('lexicon', 5, 22),
      },
    }

    expect(getOfflineSetupSizeSummary([makeItem('bible'), makeItem('lexicon')], manifest)).toEqual({
      downloadBytes: 7,
      installedBytes: 37,
    })
  })

  it('counts a shared dependency only once', () => {
    const manifest: OfflineResourceSizeManifest = {
      schemaVersion: 1,
      generatedAt: '2026-08-11T00:00:00.000Z',
      resources: {
        shared: makeSize('shared', 3, 10),
      },
    }

    expect(getOfflineSetupSizeSummary([makeItem('shared'), makeItem('shared')], manifest)).toEqual({
      downloadBytes: 3,
      installedBytes: 10,
    })
  })
})
