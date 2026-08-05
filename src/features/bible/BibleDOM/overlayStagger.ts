export const OVERLAY_SOURCE_STAGGER_SECONDS = 0.07
export const OVERLAY_SOURCE_SETTLE_SECONDS = 0.38
export const OVERLAY_ADDITIONAL_STAGGER_SECONDS = 0.05

export const getOverlaySourceDelay = (sourceIndex: number, shouldReduceMotion: boolean | null) =>
  shouldReduceMotion ? 0 : sourceIndex * OVERLAY_SOURCE_STAGGER_SECONDS

export const getOverlayAdditionalStartDelay = (
  sourceItemCount: number,
  shouldReduceMotion: boolean | null
) => {
  if (shouldReduceMotion) return 0
  if (!sourceItemCount) return 0.16

  return (sourceItemCount - 1) * OVERLAY_SOURCE_STAGGER_SECONDS + OVERLAY_SOURCE_SETTLE_SECONDS
}
