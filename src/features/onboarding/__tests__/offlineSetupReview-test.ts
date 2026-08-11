import type { OfflineResourceSizeManifest } from '~helpers/offlineResourceSizeManifest'
import type { OnboardingResourceSelection } from '../onboardingResources'
import {
  getOfflineSetupReviewDragProgress,
  getOfflineSetupReviewExpandedHeight,
  getOfflineSetupReviewItems,
  getOfflineSetupReviewLayout,
  getOfflineSetupReviewSnapPoint,
} from '../offlineSetupReview'

jest.mock('../onboardingResources', () => ({
  createDownloadItemFromOnboardingSelection: jest.fn((selection: { id: string; name: string }) => ({
    id: selection.id,
    name: selection.name,
    estimatedSize: 1,
  })),
}))

const manifest: OfflineResourceSizeManifest = {
  schemaVersion: 1,
  generatedAt: '2026-08-11T00:00:00.000Z',
  resources: {
    shared: {
      id: 'shared',
      url: 'https://example.com/shared',
      downloadBytes: 5,
      contentBytes: 12,
      installedBytes: 12,
      peakInstallationBytes: 14,
      strategy: 'archive-extract',
      confidence: 'exact',
    },
  },
}

describe('offline setup review', () => {
  it('lists a shared physical resource only once', () => {
    const selection = {
      id: 'shared',
      name: 'Strong lexicon',
    } as unknown as OnboardingResourceSelection
    expect(getOfflineSetupReviewItems([selection, selection], manifest)).toEqual([
      {
        id: 'shared',
        name: 'Strong lexicon',
        downloadBytes: 5,
        installedBytes: 12,
      },
    ])
  })

  it('uses position and upward momentum to choose the open snap point', () => {
    expect(getOfflineSetupReviewSnapPoint({ progress: 0.7, velocityY: 0 })).toBe(1)
    expect(getOfflineSetupReviewSnapPoint({ progress: 0.3, velocityY: -2_000 })).toBe(1)
    expect(getOfflineSetupReviewSnapPoint({ progress: 0.3, velocityY: 800 })).toBe(0)
  })

  it('tracks directly between snap points and resists overdrag at both edges', () => {
    expect(getOfflineSetupReviewDragProgress({ rawProgress: 0.4, sheetTravel: 500 })).toBe(0.4)

    const belowClosed = getOfflineSetupReviewDragProgress({
      rawProgress: -0.5,
      sheetTravel: 500,
    })
    const aboveOpen = getOfflineSetupReviewDragProgress({
      rawProgress: 1.5,
      sheetTravel: 500,
    })

    expect(belowClosed).toBeLessThan(0)
    expect(belowClosed).toBeGreaterThan(-28 / 500)
    expect(aboveOpen).toBeGreaterThan(1)
    expect(aboveOpen).toBeLessThan(1 + 28 / 500)
  })

  it('adds progressively less movement as overdrag increases', () => {
    const shortPull = getOfflineSetupReviewDragProgress({
      rawProgress: 1.2,
      sheetTravel: 500,
    })
    const longPull = getOfflineSetupReviewDragProgress({
      rawProgress: 2,
      sheetTravel: 500,
    })

    expect(longPull).toBeGreaterThan(shortPull)
    expect(longPull - shortPull).toBeLessThan(0.02)
  })

  it('sizes the expanded sheet from its rows until it reaches the maximum height', () => {
    const oneItemHeight = getOfflineSetupReviewExpandedHeight({
      bottomInset: 34,
      itemCount: 1,
      maxHeight: 600,
    })
    const threeItemHeight = getOfflineSetupReviewExpandedHeight({
      bottomInset: 34,
      itemCount: 3,
      maxHeight: 600,
    })
    const cappedHeight = getOfflineSetupReviewExpandedHeight({
      bottomInset: 34,
      itemCount: 20,
      maxHeight: 600,
    })

    expect(oneItemHeight).toBe(281)
    expect(threeItemHeight).toBe(415)
    expect(cappedHeight).toBe(600)
  })

  it('enables scrolling only when the intrinsic content exceeds the maximum height', () => {
    expect(
      getOfflineSetupReviewLayout({
        bottomInset: 34,
        itemCount: 3,
        maxHeight: 600,
      })
    ).toEqual({
      expandedHeight: 415,
      scrollEnabled: false,
    })

    expect(
      getOfflineSetupReviewLayout({
        bottomInset: 34,
        itemCount: 20,
        maxHeight: 600,
      })
    ).toEqual({
      expandedHeight: 600,
      scrollEnabled: true,
    })
  })
})
