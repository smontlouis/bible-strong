import type { DownloadItemState, DownloadStatus } from '~state/downloadQueue'

import { getDownloadQueueDecision } from '../downloadQueueScheduling'

const createState = (
  id: string,
  status: DownloadStatus,
  dependsOnId?: string
): DownloadItemState => ({
  item: {
    id,
    type: 'bible',
    name: id,
    url: `https://example.com/${id}`,
    estimatedSize: 1,
    dependsOnId,
    addedAt: 0,
    retryCount: 0,
  },
  status,
  downloadProgress: 0,
  insertProgress: 0,
})

describe('download queue scheduling', () => {
  it('processes a prerequisite before its dependent item', () => {
    const states = new Map([
      ['sidecar', createState('sidecar', 'queued', 'bible')],
      ['bible', createState('bible', 'queued')],
    ])

    expect(getDownloadQueueDecision(states)).toEqual({ next: states.get('bible') })
  })

  it('processes a dependent item after its prerequisite completes', () => {
    const states = new Map([
      ['bible', createState('bible', 'completed')],
      ['sidecar', createState('sidecar', 'queued', 'bible')],
    ])

    expect(getDownloadQueueDecision(states)).toEqual({ next: states.get('sidecar') })
  })

  it.each(['failed', 'cancelled'] as const)(
    'blocks a dependent item when its prerequisite is %s',
    dependencyStatus => {
      const states = new Map([
        ['bible', createState('bible', dependencyStatus)],
        ['sidecar', createState('sidecar', 'queued', 'bible')],
      ])

      expect(getDownloadQueueDecision(states)).toEqual({ blocked: states.get('sidecar') })
    }
  )
})
