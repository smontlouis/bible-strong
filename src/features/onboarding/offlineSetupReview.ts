import type { DownloadItem } from '~helpers/offlineCopy'
import {
  getOfflineResourceSizeEntry,
  type OfflineResourceSizeManifest,
} from '~helpers/offlineResourceSizeManifest'
import type { OnboardingResourceSelection } from './onboardingResources'
import { createDownloadItemFromOnboardingSelection } from './onboardingResources'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
import type { OfflineSetupFolderId } from './offlineSetupPresets'
import type { OfflineSetupFolderVisual, OfflineSetupFrame } from './offlineSetupPresentation'

export type OfflineSetupReviewItem = {
  id: string
  name: string
  downloadBytes: number
  installedBytes: number
}

export type OfflineSetupReviewSummary = {
  downloadBytes: number
  installedBytes: number
  items: readonly OfflineSetupReviewItem[]
}

export type OfflineSetupReviewFolderContext = {
  folderId: OfflineSetupFolderId
  heroOverlayActive: boolean
  selectedCount: number
  summary: OfflineSetupReviewSummary
  title: string
  visual: OfflineSetupFolderVisual
  onClose: (heroFrame?: OfflineSetupFrame) => void
  onHeroTargetLayout: (heroFrame: OfflineSetupFrame) => void
}

export const getOfflineSetupReviewSummary = (
  items: readonly OfflineSetupReviewItem[]
): OfflineSetupReviewSummary => {
  let downloadBytes = 0
  let installedBytes = 0

  for (const item of items) {
    downloadBytes += item.downloadBytes
    installedBytes += item.installedBytes
  }

  return { downloadBytes, installedBytes, items }
}

type OfflineSetupReviewLayoutParams = {
  bottomInset: number
  itemCount: number
  maxHeight: number
}

export type OfflineSetupReviewLayout = {
  expandedHeight: number
  scrollEnabled: boolean
}

export const getOfflineSetupReviewListTopInset = (): number => {
  const layout = OFFLINE_SETUP_MOTION.reviewSheet.layout

  return (
    layout.headerTop +
    layout.summaryHeight +
    layout.subtitleMarginTop +
    layout.subtitleHeight +
    layout.listMarginTop
  )
}

export const getOfflineSetupReviewLayout = ({
  bottomInset,
  itemCount,
  maxHeight,
}: OfflineSetupReviewLayoutParams): OfflineSetupReviewLayout => {
  const reviewMotion = OFFLINE_SETUP_MOTION.reviewSheet
  const layout = reviewMotion.layout
  const rowCount = Math.max(0, itemCount)
  const rowGaps = Math.max(0, rowCount - 1)
  const headerHeight = getOfflineSetupReviewListTopInset()
  const rowsHeight = rowCount * layout.resourceRowHeight + rowGaps * layout.resourceRowGap
  const buttonClearance =
    layout.buttonHeight + layout.buttonBottom + bottomInset + layout.bottomSpacing
  const contentHeight = headerHeight + rowsHeight + buttonClearance
  const expandedHeight = Math.max(reviewMotion.closedHeight, Math.min(maxHeight, contentHeight))

  return {
    expandedHeight,
    scrollEnabled: contentHeight > maxHeight,
  }
}

export const getOfflineSetupReviewExpandedHeight = (
  params: OfflineSetupReviewLayoutParams
): number => getOfflineSetupReviewLayout(params).expandedHeight

const getUniqueDownloadItems = (
  selections: readonly OnboardingResourceSelection[]
): DownloadItem[] => [
  ...new Map(
    selections.map(selection => {
      const item = createDownloadItemFromOnboardingSelection(selection)
      return [item.id, item]
    })
  ).values(),
]

export const getOfflineSetupReviewItems = (
  selections: readonly OnboardingResourceSelection[],
  manifest: OfflineResourceSizeManifest
): OfflineSetupReviewItem[] =>
  getUniqueDownloadItems(selections).map(item => {
    const size = getOfflineResourceSizeEntry(item.id, item.estimatedSize, manifest)
    return {
      id: item.id,
      name: item.name,
      downloadBytes: size.downloadBytes,
      installedBytes: size.installedBytes,
    }
  })

export const getOfflineSetupReviewSnapPoint = ({
  progress,
  velocityY,
}: {
  progress: number
  velocityY: number
}): 0 | 1 => {
  'worklet'

  const reviewMotion = OFFLINE_SETUP_MOTION.reviewSheet
  const projectedProgress = progress - velocityY * reviewMotion.velocityInfluence
  if (projectedProgress >= reviewMotion.snapThreshold) return 1
  return 0
}

export const getOfflineSetupReviewDragProgress = ({
  locked,
  rawProgress,
  sheetTravel,
}: {
  locked?: boolean
  rawProgress: number
  sheetTravel: number
}): number => {
  'worklet'

  if (!locked && rawProgress >= 0 && rawProgress <= 1) return rawProgress

  const reviewMotion = OFFLINE_SETUP_MOTION.reviewSheet
  let boundary = 0
  if (!locked && rawProgress > 1) boundary = 1

  const overflowProgress = Math.abs(rawProgress - boundary)
  const overflowDistance = overflowProgress * sheetTravel
  const resistance =
    1 + (overflowDistance * reviewMotion.rubberBandCoefficient) / reviewMotion.maxOverdrag
  const resistedDistance = reviewMotion.maxOverdrag * (1 - 1 / resistance)
  const resistedProgress = resistedDistance / sheetTravel

  if (rawProgress < boundary) return boundary - resistedProgress
  return boundary + resistedProgress
}
