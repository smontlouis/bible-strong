import type { DownloadItemState } from '~state/downloadQueue'
import { getOfflineSetupDownloadTracking } from '../offlineSetupDownloadTracking'

const createState = (
  id: string,
  status: DownloadItemState['status'],
  downloadProgress = 0
): DownloadItemState => ({
  item: {
    id: id as DownloadItemState['item']['id'],
    name: id,
    url: `https://example.com/${id}`,
    estimatedSize: 1,
    addedAt: 0,
    retryCount: 0,
    type: 'database',
    databaseId: 'NAVE',
    lang: 'en',
    destinationPath: id,
    archiveEntry: id,
  },
  status,
  downloadProgress,
  insertProgress: 0,
})

describe('offline setup download tracking', () => {
  it('ignores unrelated queue entries', () => {
    const states = new Map<string, DownloadItemState>([
      ['selected', createState('selected', 'downloading', 0.5)],
      ['unrelated', createState('unrelated', 'failed')],
    ])

    expect(getOfflineSetupDownloadTracking(['selected'], states)).toEqual({
      completed: false,
      failedItem: undefined,
      progress: 0.4,
    })
  })

  it('only completes after every selected resource completes', () => {
    const states = new Map<string, DownloadItemState>([
      ['first', createState('first', 'completed')],
      ['second', createState('second', 'completed')],
    ])

    expect(getOfflineSetupDownloadTracking(['first', 'second'], states)).toEqual({
      completed: true,
      failedItem: undefined,
      progress: 1,
    })
  })

  it('reports a failure only when it belongs to the setup selection', () => {
    const failed = createState('selected', 'failed')
    failed.error = 'Network unavailable'

    expect(
      getOfflineSetupDownloadTracking(['selected'], new Map([['selected', failed]])).failedItem
    ).toBe(failed)
  })

  it('treats an empty selection as ready for installation verification', () => {
    expect(getOfflineSetupDownloadTracking([], new Map())).toEqual({
      completed: true,
      progress: 1,
    })
  })
})
