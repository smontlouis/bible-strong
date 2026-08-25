'use dom'

/**
 * Returns styles to apply when a decoration component is disabled (e.g., in annotation mode).
 * Used to dim and disable pointer events on decorations.
 */
export const getDisabledStyles = (isDisabled?: boolean) =>
  isDisabled
    ? {
        opacity: 0.3,
        pointerEvents: 'none' as const,
      }
    : {}
