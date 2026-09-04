export const COMPARE_SELECTION_VERSION = 2 as const

type CompareSelectionSettings = {
  compare?: Record<string, boolean>
  compareSelectionVersion?: number
}

/**
 * Comparison versions used to be populated implicitly when resources were
 * downloaded. Reset that legacy state once; newer explicit selections survive.
 */
export const normalizeCompareSelection = (settings?: CompareSelectionSettings) => ({
  compare:
    settings?.compareSelectionVersion === COMPARE_SELECTION_VERSION
      ? Object.fromEntries(Object.entries(settings.compare ?? {}).filter(([, enabled]) => enabled))
      : {},
  compareSelectionVersion: COMPARE_SELECTION_VERSION,
})
