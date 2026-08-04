import type { DownloadItem, DownloadItemState } from '~state/downloadQueue'

import {
  applyBibleModeAcquisitionOutcome,
  getBibleModeAcquisitionPresentation,
  getBibleModeAcquisitionQueueOutcome,
  verifyBibleModeAcquisition,
  type PendingBibleModeAcquisition,
} from '~helpers/bibleModeAcquisition'

const createState = (
  id: string,
  status: DownloadItemState['status'],
  progress = 0
): DownloadItemState => ({
  item: {
    id,
    type: id.startsWith('bible-strong:') ? 'bible-strong-sidecar' : 'bible',
    name: id,
    url: `https://example.com/${id}`,
    estimatedSize: id.startsWith('bible-strong:') ? 75 : 25,
    addedAt: 1,
    retryCount: 0,
  } as DownloadItem,
  status,
  downloadProgress: progress,
  insertProgress: 0,
})

const acquisition: PendingBibleModeAcquisition = {
  kind: 'strong',
  versionId: 'DBY',
  mode: 'visible',
  planIds: ['bible:DBY', 'bible-strong:DBY'],
}

describe('Bible mode acquisition', () => {
  it('derives weighted progress from the exact confirmed plan', () => {
    const states = new Map([
      ['bible:DBY', createState('bible:DBY', 'completed', 1)],
      ['bible-strong:DBY', createState('bible-strong:DBY', 'downloading', 0.5)],
      ['bible:BHG', createState('bible:BHG', 'downloading', 0.9)],
    ])

    expect(getBibleModeAcquisitionPresentation(acquisition, states)).toEqual({
      status: 'active',
      progress: 0.55,
    })
    expect(getBibleModeAcquisitionQueueOutcome(acquisition, states)).toBe('waiting')
  })

  it('requires availability verification only after every planned copy completes', () => {
    const states = new Map([
      ['bible:DBY', createState('bible:DBY', 'completed', 1)],
      ['bible-strong:DBY', createState('bible-strong:DBY', 'completed', 1)],
    ])

    expect(getBibleModeAcquisitionQueueOutcome(acquisition, states)).toBe('verify')
  })

  it('reconciles a persisted acquisition when its queue state is absent after restart', () => {
    expect(getBibleModeAcquisitionQueueOutcome(acquisition, new Map())).toBe('reconcile')
  })

  it('fails the transaction when one planned copy fails', () => {
    const states = new Map([
      ['bible:DBY', createState('bible:DBY', 'completed', 1)],
      ['bible-strong:DBY', createState('bible-strong:DBY', 'failed')],
    ])

    expect(getBibleModeAcquisitionQueueOutcome(acquisition, states)).toBe('failed')
  })

  it('verifies reverse interlinear readiness through the preferred locale fallback', async () => {
    const reverseAcquisition: PendingBibleModeAcquisition = {
      kind: 'strong',
      versionId: 'DBY',
      mode: 'reverse-interlinear',
      interlinearLocale: 'fr',
      planIds: ['bible-strong:DBY', 'bible-interlinear:BHG:fr'],
    }
    const getStrongAvailability = jest.fn().mockResolvedValue({ status: 'available' })
    const getInterlinearAvailability = jest
      .fn()
      .mockResolvedValueOnce({ status: 'corrupt' })
      .mockResolvedValueOnce({ status: 'available' })

    await expect(
      verifyBibleModeAcquisition(reverseAcquisition, {
        getStrongAvailability,
        getInterlinearAvailability,
      })
    ).resolves.toBe(true)
    expect(getInterlinearAvailability).toHaveBeenNthCalledWith(1, 'fr')
    expect(getInterlinearAvailability).toHaveBeenNthCalledWith(2, 'en')
  })

  it('closes the selector only after a successful verified acquisition', () => {
    const finish = jest.fn()
    const onSucceeded = jest.fn()

    applyBibleModeAcquisitionOutcome(acquisition, false, { finish, onSucceeded })

    expect(finish).toHaveBeenCalledWith(false)
    expect(onSucceeded).not.toHaveBeenCalled()

    applyBibleModeAcquisitionOutcome(acquisition, true, { finish, onSucceeded })

    expect(finish).toHaveBeenLastCalledWith(true)
    expect(onSucceeded).toHaveBeenCalledWith(acquisition)
  })
})
