import type { DownloadItemState } from '~state/downloadQueue'

import {
  getConfirmedStrongModeDownloadIds,
  getDownloadPlanPresentation,
  getStrongModeDownloadPresentation,
} from '../strongModeDownloadState'

const makeState = (
  id: string,
  status: DownloadItemState['status'],
  options: {
    type?: DownloadItemState['item']['type']
    estimatedSize?: number
    dependsOnId?: string
    downloadProgress?: number
    insertProgress?: number
  } = {}
): DownloadItemState => ({
  item: {
    id,
    type: options.type ?? 'bible-strong-sidecar',
    name: id,
    versionId: 'DBY',
    url: 'https://example.com/resource.zip',
    estimatedSize: options.estimatedSize ?? 100,
    dependsOnId: options.dependsOnId,
    addedAt: 1,
    retryCount: 0,
  },
  status,
  downloadProgress: options.downloadProgress ?? 0,
  insertProgress: options.insertProgress ?? 0,
})

describe('getStrongModeDownloadPresentation', () => {
  it('stays idle for an unrelated Bible download', () => {
    const bible = makeState('bible:DBY', 'downloading', { type: 'bible' })

    expect(getStrongModeDownloadPresentation(bible)).toEqual({
      status: 'idle',
      progress: 0,
    })
  })

  it('reports the sidecar circular progress', () => {
    const sidecar = makeState('bible-strong:DBY', 'downloading', {
      downloadProgress: 0.42,
    })

    expect(getStrongModeDownloadPresentation(undefined, sidecar)).toEqual({
      status: 'active',
      progress: 0.336,
    })
  })

  it('combines a required Bible installation with the sidecar', () => {
    const bible = makeState('bible:DBY', 'completed', {
      type: 'bible',
      estimatedSize: 25,
    })
    const sidecar = makeState('bible-strong:DBY', 'downloading', {
      dependsOnId: bible.item.id,
      estimatedSize: 75,
      downloadProgress: 0.5,
    })

    expect(getStrongModeDownloadPresentation(bible, sidecar)).toEqual({
      status: 'active',
      progress: 0.55,
    })
  })

  it('keeps sidecar progress monotonic across download and installation', () => {
    const downloaded = makeState('bible-strong:DBY', 'downloading', {
      downloadProgress: 1,
    })
    const inserting = makeState('bible-strong:DBY', 'inserting', {
      downloadProgress: 1,
      insertProgress: 0.5,
    })

    expect(getStrongModeDownloadPresentation(undefined, downloaded).progress).toBe(0.8)
    expect(getStrongModeDownloadPresentation(undefined, inserting).progress).toBe(0.9)
  })

  it('returns failed as soon as the sidecar or its dependency fails', () => {
    const bible = makeState('bible:DBY', 'failed', { type: 'bible' })
    const sidecar = makeState('bible-strong:DBY', 'queued', {
      dependsOnId: bible.item.id,
    })

    expect(getStrongModeDownloadPresentation(bible, sidecar)).toEqual({
      status: 'failed',
      progress: 0,
    })
  })

  it('keeps a full circle available for the completion transition', () => {
    const sidecar = makeState('bible-strong:DBY', 'completed')

    expect(getStrongModeDownloadPresentation(undefined, sidecar)).toEqual({
      status: 'completed',
      progress: 1,
    })
  })
})

describe('getDownloadPlanPresentation', () => {
  it('combines every resource in a reverse-interlinear download plan by size', () => {
    const strong = makeState('bible-strong:BSB', 'completed', { estimatedSize: 20 })
    const bhg = makeState('bible:BHG', 'downloading', {
      type: 'bible',
      estimatedSize: 60,
      downloadProgress: 0.5,
    })
    const interlinear = makeState('bible-interlinear:BHG:fr', 'queued', {
      type: 'bible-interlinear-sidecar',
      estimatedSize: 20,
    })

    expect(getDownloadPlanPresentation([strong, bhg, interlinear])).toEqual({
      status: 'active',
      progress: 0.44,
    })
  })
})

describe('getConfirmedStrongModeDownloadIds', () => {
  it('does not expose unrelated active downloads before confirmation', () => {
    expect(
      getConfirmedStrongModeDownloadIds({
        mode: 'reverse-interlinear',
        version: 'BSB',
      })
    ).toEqual([])
  })

  it('uses the exact plan after confirmation', () => {
    expect(
      getConfirmedStrongModeDownloadIds({
        mode: 'reverse-interlinear',
        version: 'BSB',
        requestedIds: ['bible-strong:BSB', 'bible-interlinear:BHG:en'],
      })
    ).toEqual(['bible-strong:BSB', 'bible-interlinear:BHG:en'])
  })

  it('restores the confirmed plan when the sheet is reopened', () => {
    expect(
      getConfirmedStrongModeDownloadIds({
        mode: 'reverse-interlinear',
        version: 'BSB',
        pendingVersion: 'BSB',
        pendingMode: 'reverse-interlinear',
        pendingInterlinearLocale: 'en',
      })
    ).toEqual(['bible:BSB', 'bible-strong:BSB', 'bible:BHG', 'bible-interlinear:BHG:en'])
  })
})
